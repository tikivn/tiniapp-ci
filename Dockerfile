FROM node:12-alpine
# Input your APP ID which you can get from Tini Console
ENV APP_ID ""
# Input your USER ID where you can get from ~/.tiki/credentials.json
ENV USER_ID ""
# Input your DEVELOPER ID where you can get from ~/.tiki/credentials.json
ENV DEVELOPER_ID ""
# Input your ACCESS_TOKEN where you can get from ~/.tiki/credentials.json
ENV ACCESS_TOKEN ""

ENV STUDIO_VERSION "1.92.2"
ENV MINIAPP_ENV "production"
ENV PUBLIC_PATH "./"

RUN apk add --update curl jq && \
    rm -rf /var/cache/apk/*

RUN curl -s https://salt.tikicdn.com/ts/tiniapp/3a/bc/34/74c245bfbe9cc4b9770a5c85913dd6ae.zip > /tiniapp-cli.zip && \
    unzip /tiniapp-cli.zip -d /bin && \
    rm -v /tiniapp-cli.zip

RUN curl 'https://api.tiki.vn/tiniapp/api/graphql/query' \
  -H 'content-type: application/json;charset=UTF-8' \
  -H "x-miniapp-access-token: $ACCESS_TOKEN" \
  --data-raw $'{"query":"query app_version_list_by_app_identifier(\\n                $app_identifier: String!\\n                $app_version_page: Int!\\n                $app_version_size: Int!\\n                $build_page: Int!\\n                $build_size: Int!\\n                $runtime_version: String!\\n            ) {\\n                app_version_list_by_app_identifier(\\n                    app_identifier: $app_identifier\\n                    page: $app_version_page\\n                    size: $app_version_size\\n                ) {\\n                    data {\\n                        id\\n                        status\\n                        version\\n                        builds(page: $build_page, size: $build_size, runtime_version: $runtime_version) {\\n                            total_items\\n                            data {\\n                                build_number\\n                                status\\n                            }\\n                        }\\n                    }\\n                }\\n            }\\n        ","variables":{"app_identifier":"'$APP_ID'","app_version_page":1,"app_version_size":1,"build_page":1,"build_size":1,"runtime_version":"1.1.1"}}' \
  --compressed > version.json

RUN touch /$(cat version.json | jq -r '.data.app_version_list_by_app_identifier.data[0].version')_$(cat version.json | jq -r '.data.app_version_list_by_app_identifier.data[0].builds.data[0].build_number')_$(cat version.json | jq -r '.data.app_version_list_by_app_identifier.data[0].status')

RUN  \
  if [ -f "$(cat version.json | jq -r '.data.app_version_list_by_app_identifier.data[0].version')_$(cat version.json | jq -r '.data.app_version_list_by_app_identifier.data[0].builds.data[0].build_number')_draft" ] \
  ;then \
    # current version in draft -> increase build
    echo "{ \"version\": \"$(cat version.json | jq -r '.data.app_version_list_by_app_identifier.data[0].version')\", \"build_number\": \"$(($(cat version.json | jq -r '.data.app_version_list_by_app_identifier.data[0].builds.data[0].build_number')+1))\" }" > next_version.json \
  ;else \
    # no draft version -> new version
    echo "{ \"version\": \"$(cat version.json | jq -r '.data.app_version_list_by_app_identifier.data[0].version' | awk -F. -v OFS=. '{$NF += 1 ; print}')\", \"build_number\": \"1\" }" > next_version.json \
  ;fi

RUN mkdir -p /.tiki \
  && echo "{ \"$USER_ID.$DEVELOPER_ID\": { \"id\": \"$DEVELOPER_ID\", \"accessToken\": \"$ACCESS_TOKEN\" } }" > /.tiki/credentials.json

COPY . /app/

WORKDIR /app

RUN npm install

RUN /bin/miniapp-cli-alpine publish \
  --developer_id $DEVELOPER_ID \
  --app_identifier $APP_ID \
  --credential_path /.tiki/credentials.json \
  --app_version $(cat /next_version.json | jq -r '.version') \
  --build_number $(cat /next_version.json | jq -r '.build_number') \
  --studio_version $STUDIO_VERSION

