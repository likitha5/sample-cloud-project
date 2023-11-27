## Architecture
<img width="1042" alt="architecture-screenshot" src="https://awsdevhour.s3-accelerate.amazonaws.com/architecture.jpg">

## Useful commands

 * `npm install`     install packages
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy`      deploy this stack
 * `cdk diff`        compare deployed stack with current state

 The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Prerequisites

All CDK developers need to install latest Node.js, even those working in languages other than TypeScript or JavaScript. The AWS CDK Toolkit (cdk command-line tool) and the AWS Construct Library run on Node.js. The bindings for other supported languages use this back end and tool set. We suggest the latest LTS version.
```bash
aws configure
npm -g install typescript
npm install -g aws-cdk
```
If you have not yet done so, you will also need to bootstrap your account:

```bash
cdk bootstrap aws://ACCOUNT-NUMBER-1/REGION-1
```
Must have AWS user account with CLI access and need to configure locally before getting started.

## Getting Started

1. `npm install` 

2. `cdk deploy`

A 'cdk deploy' will deploy everything that you need into your account

3. You may now test the backend by uploading an image into your Amazon S3 bucket. 


### Contributions

AWS Dev Hour 
### Repository:  https://github.com/aws-samples/aws-dev-hour-backend

### License

This software is licensed under the Apache License, Version 2.0.
