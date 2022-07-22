# Continuous Integration (CI) configuration examples for TiniApp

This repo. makes it easy to run tests and publish your app to Tini Console.

## Version & Build number

The script will increase version and build number based on your current version and status.

- If your current version is Draft -> it will increase the build number to next one.
- If your current version is NOT Draft -> it will increase the version and set build number to 1.


## Supported CI platforms
- TikiCI 
- Github Action
- CircleCI (TODO)

### TikiCI

1. Create new CI workload on kratos
2. Create Github Repo Action List
3. Add 3 files config: .tikici.yml, Dockerfile, Jenkinsfile
4. Use Dockerfile.sample for Dockerfile

### Github Action

Adds a workflow with .yml file:
```yml
on: [push]

jobs:
  publish_tiniapp:
    runs-on: ubuntu-latest
    name: Publish TiniApp to Tini Console
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v1
        with:
          node-version: 15.0.1

      - name: Install packages
        run: npm install --network-timeout=300000

      - name: Build and publish app to Tini Console
        id: hello
        uses: tikivn/tiniapp-ci@main
        with:
          app-id: ${{secrets.APP_ID}}
          user-id: ${{secrets.USER_ID}}
          developer-id: ${{secrets.DEVELOPER_ID}}
          access-token: ${{secrets.ACCESS_TOKEN}}
          studio-version: 1.92.2
```

### CircleCI

TBU
