const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const axios = require('axios');
const fs = require('fs');
const {dirname} = require('path');

function getCliUrl(studioVersion) {
  if (studioVersion) {
    return `https://tiniapp-media.tikicdn.com/tiniapp-ci/tiniapp-ci-v${studioVersion}.zip`;
  }
  return 'https://tiniapp-media.tikicdn.com/tiniapp-ci/tiniapp-ci-latest.zip';
}

function increment(version) {
  var terms = version.split('.').map(function (e) {
    return parseInt(e);
  });
  if (terms.length != 3) {
    return version;
  }
  if (++terms[2] > 9) {
    ++terms[1];
    terms[2] = 0;
  }
  return terms.join('.');
}

async function run() {
  try {
    const appId = core.getInput('app-id');
    const userId = core.getInput('user-id');
    const developerId = core.getInput('developer-id');
    const inputVersion = core.getInput('version');
    const inputBuildNumber = core.getInput('build-number');
    const accessToken = core.getInput('access-token');
    const studioVersion = core.getInput('studio-version');

    core.info(`APP ID: ${appId}`);

    // download tiniapp-cli
    const cliUrl = getCliUrl(studioVersion);
    const path = await tc.downloadTool(cliUrl);
    const dir = dirname(path);

    await exec.exec(`unzip ${path} -d ${dir}`);
    // store to cached
    const cachedPath = await tc.cacheDir(dir, 'tiniapp-ci', studioVersion);
    core.addPath(cachedPath);

    const credentails = {
      [`${userId}.${developerId}`]: {
        id: developerId,
        accessToken,
      },
    };
    fs.writeFileSync('/tmp/credentials.json', JSON.stringify(credentails));

    const variables = {
      app_identifier: appId,
      app_version_page: 1,
      app_version_size: 1,
      build_page: 1,
      build_size: 1,
      runtime_version: '1.1.1',
    };
    let nextVersion = inputVersion || '1.0.0';
    let nextBuildNumber = inputBuildNumber || 1;

    if (!inputVersion && !inputBuildNumber) {
      const result = await axios.post(
        'https://api.tiki.vn/tiniapp/api/graphql/query',
        {
          query: `query app_version_list_by_app_identifier(
            $app_identifier: String!
            $app_version_page: Int!
            $app_version_size: Int!
            $build_page: Int!
            $build_size: Int!
            $runtime_version: String!
        ) {
            app_version_list_by_app_identifier(
                app_identifier: $app_identifier
                page: $app_version_page
                size: $app_version_size
            ) {
                data {
                    id
                    status
                    version
                    builds(page: $build_page, size: $build_size, runtime_version: $runtime_version) {
                        total_items
                        data {
                            build_number
                            status
                        }
                    }
                }
            }
        }`,
          variables,
        },
        {
          headers: {
            'x-miniapp-access-token': accessToken,
            'content-type': 'application/json;charset=UTF-8',
          },
        },
      );

      core.info(JSON.stringify(result.data));

      const {
        data: {
          app_version_list_by_app_identifier: {data: versions},
        },
      } = result.data;

      if (versions && versions.length) {
        const [latestVersion] = versions;
        const {
          version,
          status,
          builds: {data: builds},
        } = latestVersion;
        const [latestBuild] = builds;

        const {build_number: buildNumber} = latestBuild;

        if (!inputVersion && !inputBuildNumber) {
          if (status === 'draft') {
            nextVersion = version;
            nextBuildNumber = buildNumber + 1;
          } else {
            nextVersion = increment(version);
            nextBuildNumber = 1;
          }
        }
      }
    }

    process.env.PUBLIC_PATH = './';
    process.env.MINIAPP_ENV = 'production';

    const cmd = `miniapp-cli-linux publish . \\
    --developer_id ${developerId} \\
    --app_identifier ${appId} \\
    --credential_path /tmp/credentials.json \\
    --app_version ${nextVersion} \\
    --build_number ${nextBuildNumber} \\
    --studio_version ${studioVersion}`;

    await exec.exec(cmd);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
