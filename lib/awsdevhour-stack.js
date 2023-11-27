"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsdevhourStack = void 0;
const cdk = require("@aws-cdk/core");
const s3 = require("@aws-cdk/aws-s3");
const iam = require("@aws-cdk/aws-iam");
const dynamodb = require("@aws-cdk/aws-dynamodb");
const lambda = require("@aws-cdk/aws-lambda");
const event_sources = require("@aws-cdk/aws-lambda-event-sources");
const cognito = require("@aws-cdk/aws-cognito");
const aws_apigateway_1 = require("@aws-cdk/aws-apigateway");
const core_1 = require("@aws-cdk/core");
const core_2 = require("@aws-cdk/core");
const apigw = require("@aws-cdk/aws-apigateway");
const s3deploy = require("@aws-cdk/aws-s3-deployment");
const aws_s3_1 = require("@aws-cdk/aws-s3");
const sqs = require("@aws-cdk/aws-sqs");
const s3n = require("@aws-cdk/aws-s3-notifications");
const imageBucketName = "cdk-rekn-imgagebucket";
const resizedBucketName = imageBucketName + "-resized";
const websiteBucketName = "cdk-rekn-publicbucket";
class AwsdevhourStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // =====================================================================================
        // Image Bucket
        // =====================================================================================
        const imageBucket = new s3.Bucket(this, imageBucketName, {
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        new cdk.CfnOutput(this, 'imageBucket', { value: imageBucket.bucketName });
        const imageBucketArn = imageBucket.bucketArn;
        imageBucket.addCorsRule({
            allowedMethods: [aws_s3_1.HttpMethods.GET, aws_s3_1.HttpMethods.PUT],
            allowedOrigins: ["*"],
            allowedHeaders: ["*"],
            maxAge: 3000
        });
        // =====================================================================================
        // Thumbnail Bucket
        // =====================================================================================
        const resizedBucket = new s3.Bucket(this, resizedBucketName, {
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        new cdk.CfnOutput(this, 'resizedBucket', { value: resizedBucket.bucketName });
        const resizedBucketArn = resizedBucket.bucketArn;
        resizedBucket.addCorsRule({
            allowedMethods: [aws_s3_1.HttpMethods.GET, aws_s3_1.HttpMethods.PUT],
            allowedOrigins: ["*"],
            allowedHeaders: ["*"],
            maxAge: 3000
        });
        // =====================================================================================
        // Construct to create our Amazon S3 Bucket to host our website
        // =====================================================================================
        const webBucket = new s3.Bucket(this, websiteBucketName, {
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            // publicReadAccess: true
        });
        webBucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [webBucket.arnForObjects('*')],
            principals: [new iam.AnyPrincipal()],
            conditions: {
                'IpAddress': {
                    'aws:SourceIp': [
                        "2600:1700:6200:3090:a496:2821:facf:9c72",
                        "104.11.177.228" // Please change it to your IP address or from your allowed list
                    ]
                }
            }
        }));
        new cdk.CfnOutput(this, 'bucketURL', { value: webBucket.bucketWebsiteDomainName });
        // =====================================================================================
        // Deploy site contents to S3 Bucket
        // =====================================================================================
        new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.asset('./public')],
            destinationBucket: webBucket
        });
        // =====================================================================================
        // Amazon DynamoDB table for storing image labels
        // =====================================================================================
        const table = new dynamodb.Table(this, 'ImageLabels', {
            partitionKey: { name: 'image', type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        new cdk.CfnOutput(this, 'ddbTable', { value: table.tableName });
        // =====================================================================================
        // Building our AWS Lambda Function; compute for our serverless microservice
        // =====================================================================================
        const layer = new lambda.LayerVersion(this, 'pil', {
            code: lambda.Code.fromAsset('reklayer'),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_7],
            license: 'Apache-2.0',
            description: 'A layer to enable the PIL library in our Rekognition Lambda',
        });
        // =====================================================================================
        // Building our AWS Lambda Function; compute for our serverless microservice
        // =====================================================================================
        const rekFn = new lambda.Function(this, 'rekognitionFunction', {
            code: lambda.Code.fromAsset('rekognitionlambda'),
            runtime: lambda.Runtime.PYTHON_3_7,
            handler: 'index.handler',
            timeout: core_2.Duration.seconds(30),
            memorySize: 1024,
            layers: [layer],
            environment: {
                "TABLE": table.tableName,
                "BUCKET": imageBucket.bucketName,
                "RESIZEDBUCKET": resizedBucket.bucketName
            },
        });
        imageBucket.grantRead(rekFn);
        resizedBucket.grantPut(rekFn);
        table.grantWriteData(rekFn);
        rekFn.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['rekognition:DetectLabels'],
            resources: ['*']
        }));
        // =====================================================================================
        // Lambda for Synchronous Front End
        // =====================================================================================
        const serviceFn = new lambda.Function(this, 'serviceFunction', {
            code: lambda.Code.fromAsset('servicelambda'),
            runtime: lambda.Runtime.PYTHON_3_7,
            handler: 'index.handler',
            environment: {
                "TABLE": table.tableName,
                "BUCKET": imageBucket.bucketName,
                "RESIZEDBUCKET": resizedBucket.bucketName
            },
        });
        imageBucket.grantWrite(serviceFn);
        resizedBucket.grantWrite(serviceFn);
        table.grantReadWriteData(serviceFn);
        const api = new apigw.LambdaRestApi(this, 'imageAPI', {
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: apigw.Cors.ALL_METHODS
            },
            handler: serviceFn,
            proxy: false,
        });
        // =====================================================================================
        // This construct builds a new Amazon API Gateway with AWS Lambda Integration
        // =====================================================================================
        const lambdaIntegration = new apigw.LambdaIntegration(serviceFn, {
            proxy: false,
            requestParameters: {
                'integration.request.querystring.action': 'method.request.querystring.action',
                'integration.request.querystring.key': 'method.request.querystring.key'
            },
            requestTemplates: {
                'application/json': JSON.stringify({ action: "$util.escapeJavaScript($input.params('action'))", key: "$util.escapeJavaScript($input.params('key'))" })
            },
            passthroughBehavior: aws_apigateway_1.PassthroughBehavior.WHEN_NO_TEMPLATES,
            integrationResponses: [
                {
                    statusCode: "200",
                    responseParameters: {
                        // We can map response parameters
                        // - Destination parameters (the key) are the response parameters (used in mappings)
                        // - Source parameters (the value) are the integration response parameters or expressions
                        'method.response.header.Access-Control-Allow-Origin': "'*'"
                    }
                },
                {
                    // For errors, we check if the error message is not empty, get the error data
                    selectionPattern: "(\n|.)+",
                    statusCode: "500",
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': "'*'"
                    }
                }
            ],
        });
        // =====================================================================================
        // Cognito User Pool Authentication
        // =====================================================================================
        const userPool = new cognito.UserPool(this, "UserPool", {
            selfSignUpEnabled: true,
            autoVerify: { email: true },
            signInAliases: { username: true, email: true }, // Set email as an alias
        });
        const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
            userPool,
            generateSecret: false, // Don't need to generate secret for web app running on browsers
        });
        const identityPool = new cognito.CfnIdentityPool(this, "ImageRekognitionIdentityPool", {
            allowUnauthenticatedIdentities: false,
            cognitoIdentityProviders: [
                {
                    clientId: userPoolClient.userPoolClientId,
                    providerName: userPool.userPoolProviderName,
                },
            ],
        });
        const auth = new apigw.CfnAuthorizer(this, 'APIGatewayAuthorizer', {
            name: 'customer-authorizer',
            identitySource: 'method.request.header.Authorization',
            providerArns: [userPool.userPoolArn],
            restApiId: api.restApiId,
            type: aws_apigateway_1.AuthorizationType.COGNITO,
        });
        const authenticatedRole = new iam.Role(this, "ImageRekognitionAuthenticatedRole", {
            assumedBy: new iam.FederatedPrincipal("cognito-identity.amazonaws.com", {
                StringEquals: {
                    "cognito-identity.amazonaws.com:aud": identityPool.ref,
                },
                "ForAnyValue:StringLike": {
                    "cognito-identity.amazonaws.com:amr": "authenticated",
                },
            }, "sts:AssumeRoleWithWebIdentity"),
        });
        // IAM policy granting users permission to upload, download and delete their own pictures
        authenticatedRole.addToPolicy(new iam.PolicyStatement({
            actions: [
                "s3:GetObject",
                "s3:PutObject"
            ],
            effect: iam.Effect.ALLOW,
            resources: [
                imageBucketArn + "/private/${cognito-identity.amazonaws.com:sub}/*",
                imageBucketArn + "/private/${cognito-identity.amazonaws.com:sub}",
                resizedBucketArn + "/private/${cognito-identity.amazonaws.com:sub}/*",
                resizedBucketArn + "/private/${cognito-identity.amazonaws.com:sub}"
            ],
        }));
        // IAM policy granting users permission to list their pictures
        authenticatedRole.addToPolicy(new iam.PolicyStatement({
            actions: ["s3:ListBucket"],
            effect: iam.Effect.ALLOW,
            resources: [
                imageBucketArn,
                resizedBucketArn
            ],
            conditions: { "StringLike": { "s3:prefix": ["private/${cognito-identity.amazonaws.com:sub}/*"] } }
        }));
        new cognito.CfnIdentityPoolRoleAttachment(this, "IdentityPoolRoleAttachment", {
            identityPoolId: identityPool.ref,
            roles: { authenticated: authenticatedRole.roleArn },
        });
        // Export values of Cognito
        new core_1.CfnOutput(this, "UserPoolId", {
            value: userPool.userPoolId,
        });
        new core_1.CfnOutput(this, "AppClientId", {
            value: userPoolClient.userPoolClientId,
        });
        new core_1.CfnOutput(this, "IdentityPoolId", {
            value: identityPool.ref,
        });
        // =====================================================================================
        // API Gateway
        // =====================================================================================
        const imageAPI = api.root.addResource('images');
        // GET /images
        imageAPI.addMethod('GET', lambdaIntegration, {
            authorizationType: aws_apigateway_1.AuthorizationType.COGNITO,
            authorizer: { authorizerId: auth.ref },
            requestParameters: {
                'method.request.querystring.action': true,
                'method.request.querystring.key': true
            },
            methodResponses: [
                {
                    statusCode: "200",
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                },
                {
                    statusCode: "500",
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                }
            ]
        });
        // DELETE /images
        imageAPI.addMethod('DELETE', lambdaIntegration, {
            authorizationType: aws_apigateway_1.AuthorizationType.COGNITO,
            authorizer: { authorizerId: auth.ref },
            requestParameters: {
                'method.request.querystring.action': true,
                'method.request.querystring.key': true
            },
            methodResponses: [
                {
                    statusCode: "200",
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                },
                {
                    statusCode: "500",
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                }
            ]
        });
        // =====================================================================================
        // Building SQS queue and DeadLetter Queue
        // =====================================================================================
        const dlQueue = new sqs.Queue(this, 'ImageDLQueue', {
            queueName: 'ImageDLQueue'
        });
        const queue = new sqs.Queue(this, 'ImageQueue', {
            queueName: 'ImageQueue',
            visibilityTimeout: cdk.Duration.seconds(30),
            receiveMessageWaitTime: cdk.Duration.seconds(20),
            deadLetterQueue: {
                maxReceiveCount: 2,
                queue: dlQueue
            }
        });
        // =====================================================================================
        // Building S3 Bucket Create Notification to SQS
        // =====================================================================================
        imageBucket.addObjectCreatedNotification(new s3n.SqsDestination(queue), { prefix: 'private/' });
        // =====================================================================================
        // Lambda(Rekognition) to consume messages from SQS
        // =====================================================================================
        rekFn.addEventSource(new event_sources.SqsEventSource(queue));
    }
}
exports.AwsdevhourStack = AwsdevhourStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzZGV2aG91ci1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImF3c2RldmhvdXItc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXFDO0FBQ3JDLHNDQUF1QztBQUN2Qyx3Q0FBeUM7QUFDekMsa0RBQW1EO0FBQ25ELDhDQUErQztBQUMvQyxtRUFBb0U7QUFDcEUsZ0RBQWlEO0FBQ2pELDREQUFpRjtBQUNqRix3Q0FBMEM7QUFDMUMsd0NBQXlDO0FBQ3pDLGlEQUFrRDtBQUNsRCx1REFBd0Q7QUFDeEQsNENBQThDO0FBQzlDLHdDQUF5QztBQUN6QyxxREFBc0Q7QUFFdEQsTUFBTSxlQUFlLEdBQUcsdUJBQXVCLENBQUE7QUFDL0MsTUFBTSxpQkFBaUIsR0FBRyxlQUFlLEdBQUcsVUFBVSxDQUFBO0FBQ3RELE1BQU0saUJBQWlCLEdBQUcsdUJBQXVCLENBQUE7QUFFakQsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVDLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsd0ZBQXdGO1FBQ3hGLGVBQWU7UUFDZix3RkFBd0Y7UUFDeEYsTUFBTSxXQUFXLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDdkQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFDSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxXQUFXLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUMxRSxNQUFNLGNBQWMsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDO1FBQzdDLFdBQVcsQ0FBQyxXQUFXLENBQUM7WUFDdEIsY0FBYyxFQUFFLENBQUMsb0JBQVcsQ0FB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RjtRQUN4RiwwQ0FBMEM7UUFDMUMsd0ZBQXdGO1FBQ3hGLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ2xELFNBQVMsRUFBRSxjQUFjO1NBQzFCLENBQUMsQ0FBQTtRQUVGLE1BQU0sS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQzlDLFNBQVMsRUFBRSxZQUFZO1lBQ3ZCLGlCQUFpQixFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUMzQyxzQkFBc0IsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDaEQsZUFBZSxFQUFFO2dCQUNmLGVBQWUsRUFBRSxDQUFDO2dCQUNsQixLQUFLLEVBQUUsT0FBTzthQUNmO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsd0ZBQXdGO1FBQ3hGLGdEQUFnRDtRQUNoRCx3RkFBd0Y7UUFDeEYsV0FBVyxDQUFDLDRCQUE0QixDQUFDLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFBO1FBRS9GLHdGQUF3RjtRQUN4RixtREFBbUQ7UUFDbkQsd0ZBQXdGO1FBQ3hGLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxhQUFhLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDaEUsQ0FBQztDQUNGO0FBOVZELDBDQThWQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdAYXdzLWNkay9jb3JlJztcbmltcG9ydCBzMyA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1zMycpO1xuaW1wb3J0IGlhbSA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1pYW0nKTtcbmltcG9ydCBkeW5hbW9kYiA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1keW5hbW9kYicpO1xuaW1wb3J0IGxhbWJkYSA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1sYW1iZGEnKTtcbmltcG9ydCBldmVudF9zb3VyY2VzID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWxhbWJkYS1ldmVudC1zb3VyY2VzJyk7XG5pbXBvcnQgY29nbml0byA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1jb2duaXRvJyk7XG5pbXBvcnQgeyBBdXRob3JpemF0aW9uVHlwZSwgUGFzc3Rocm91Z2hCZWhhdmlvciB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCB7IENmbk91dHB1dCB9IGZyb20gXCJAYXdzLWNkay9jb3JlXCI7XG5pbXBvcnQgeyBEdXJhdGlvbiB9IGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IGFwaWd3ID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWFwaWdhdGV3YXknKTtcbmltcG9ydCBzM2RlcGxveSA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1zMy1kZXBsb3ltZW50Jyk7XG5pbXBvcnQgeyBIdHRwTWV0aG9kcyB9IGZyb20gJ0Bhd3MtY2RrL2F3cy1zMyc7XG5pbXBvcnQgc3FzID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLXNxcycpO1xuaW1wb3J0IHMzbiA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1zMy1ub3RpZmljYXRpb25zJyk7XG5cbmNvbnN0IGltYWdlQnVja2V0TmFtZSA9IFwiY2RrLXJla24taW1nYWdlYnVja2V0XCJcbmNvbnN0IHJlc2l6ZWRCdWNrZXROYW1lID0gaW1hZ2VCdWNrZXROYW1lICsgXCItcmVzaXplZFwiXG5jb25zdCB3ZWJzaXRlQnVja2V0TmFtZSA9IFwiY2RrLXJla24tcHVibGljYnVja2V0XCJcblxuZXhwb3J0IGNsYXNzIEF3c2RldmhvdXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gSW1hZ2UgQnVja2V0XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGltYWdlQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBpbWFnZUJ1Y2tldE5hbWUsIHtcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICB9KTtcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnaW1hZ2VCdWNrZXQnLCB7IHZhbHVlOiBpbWFnZUJ1Y2tldC5idWNrZXROYW1lIH0pO1xuICAgIGNvbnN0IGltYWdlQnVja2V0QXJuID0gaW1hZ2VCdWNrZXQuYnVja2V0QXJuO1xuICAgIGltYWdlQnVja2V0LmFkZENvcnNSdWxlKHtcbiAgICAgIGFsbG93ZWRNZXRob2RzOiBbSHR0cE1ldGhvZHMuR0VULCBIdHRwTWV0aG9kcy5QVVRdLFxuICAgICAgYWxsb3dlZE9yaWdpbnM6IFtcIipcIl0sXG4gICAgICBhbGxvd2VkSGVhZGVyczogW1wiKlwiXSxcbiAgICAgIG1heEFnZTogMzAwMFxuICAgIH0pO1xuICAgIFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBUaHVtYm5haWwgQnVja2V0XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IHJlc2l6ZWRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsIHJlc2l6ZWRCdWNrZXROYW1lLCB7XG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXG4gICAgfSk7XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ3Jlc2l6ZWRCdWNrZXQnLCB7dmFsdWU6IHJlc2l6ZWRCdWNrZXQuYnVja2V0TmFtZX0pO1xuICAgIGNvbnN0IHJlc2l6ZWRCdWNrZXRBcm4gPSByZXNpemVkQnVja2V0LmJ1Y2tldEFybjtcbiAgICByZXNpemVkQnVja2V0LmFkZENvcnNSdWxlKHtcbiAgICAgIGFsbG93ZWRNZXRob2RzOiBbSHR0cE1ldGhvZHMuR0VULCBIdHRwTWV0aG9kcy5QVVRdLFxuICAgICAgYWxsb3dlZE9yaWdpbnM6IFtcIipcIl0sXG4gICAgICBhbGxvd2VkSGVhZGVyczogW1wiKlwiXSxcbiAgICAgIG1heEFnZTogMzAwMFxuICAgIH0pO1xuICAgIFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDb25zdHJ1Y3QgdG8gY3JlYXRlIG91ciBBbWF6b24gUzMgQnVja2V0IHRvIGhvc3Qgb3VyIHdlYnNpdGVcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3Qgd2ViQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCB3ZWJzaXRlQnVja2V0TmFtZSwge1xuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgLy8gcHVibGljUmVhZEFjY2VzczogdHJ1ZVxuICAgIH0pO1xuICAgIFxuICAgIHdlYkJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICByZXNvdXJjZXM6IFt3ZWJCdWNrZXQuYXJuRm9yT2JqZWN0cygnKicpXSxcbiAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLkFueVByaW5jaXBhbCgpXSxcbiAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgJ0lwQWRkcmVzcyc6IHtcbiAgICAgICAgICAnYXdzOlNvdXJjZUlwJzogW1xuICAgICAgICAgICAgXCIyNjAwOjE3MDA6NjIwMDozMDkwOmE0OTY6MjgyMTpmYWNmOjljNzJcIixcbiAgICAgICAgICAgIFwiMTA0LjExLjE3Ny4yMjhcIiAvLyBQbGVhc2UgY2hhbmdlIGl0IHRvIHlvdXIgSVAgYWRkcmVzcyBvciBmcm9tIHlvdXIgYWxsb3dlZCBsaXN0XG4gICAgICAgICAgICBdXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgIH0pKVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdidWNrZXRVUkwnLCB7IHZhbHVlOiB3ZWJCdWNrZXQuYnVja2V0V2Vic2l0ZURvbWFpbk5hbWUgfSk7XG4gICAgXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIERlcGxveSBzaXRlIGNvbnRlbnRzIHRvIFMzIEJ1Y2tldFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCAnRGVwbG95V2Vic2l0ZScsIHtcbiAgICAgICAgc291cmNlczogWyBzM2RlcGxveS5Tb3VyY2UuYXNzZXQoJy4vcHVibGljJykgXSxcbiAgICAgICAgZGVzdGluYXRpb25CdWNrZXQ6IHdlYkJ1Y2tldFxuICAgIH0pO1xuICAgIFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBBbWF6b24gRHluYW1vREIgdGFibGUgZm9yIHN0b3JpbmcgaW1hZ2UgbGFiZWxzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdJbWFnZUxhYmVscycsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaW1hZ2UnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdkZGJUYWJsZScsIHsgdmFsdWU6IHRhYmxlLnRhYmxlTmFtZSB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBCdWlsZGluZyBvdXIgQVdTIExhbWJkYSBGdW5jdGlvbjsgY29tcHV0ZSBmb3Igb3VyIHNlcnZlcmxlc3MgbWljcm9zZXJ2aWNlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGxheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ3BpbCcsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgncmVrbGF5ZXInKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzddLFxuICAgICAgbGljZW5zZTogJ0FwYWNoZS0yLjAnLFxuICAgICAgZGVzY3JpcHRpb246ICdBIGxheWVyIHRvIGVuYWJsZSB0aGUgUElMIGxpYnJhcnkgaW4gb3VyIFJla29nbml0aW9uIExhbWJkYScsXG4gICAgfSk7XG4gICAg4oCLXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEJ1aWxkaW5nIG91ciBBV1MgTGFtYmRhIEZ1bmN0aW9uOyBjb21wdXRlIGZvciBvdXIgc2VydmVybGVzcyBtaWNyb3NlcnZpY2VcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3QgcmVrRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdyZWtvZ25pdGlvbkZ1bmN0aW9uJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdyZWtvZ25pdGlvbmxhbWJkYScpLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfNyxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIGxheWVyczogW2xheWVyXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgXCJUQUJMRVwiOiB0YWJsZS50YWJsZU5hbWUsXG4gICAgICAgICAgXCJCVUNLRVRcIjogaW1hZ2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgICBcIlJFU0laRURCVUNLRVRcIjogcmVzaXplZEJ1Y2tldC5idWNrZXROYW1lXG4gICAgICB9LFxuICAgIH0pO1xuICAgIFxuICAgIGltYWdlQnVja2V0LmdyYW50UmVhZChyZWtGbik7XG4gICAgcmVzaXplZEJ1Y2tldC5ncmFudFB1dChyZWtGbik7XG4gICAgdGFibGUuZ3JhbnRXcml0ZURhdGEocmVrRm4pO1xuXG4gICAgcmVrRm4uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFsncmVrb2duaXRpb246RGV0ZWN0TGFiZWxzJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgfSkpO1xuICAgIFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBMYW1iZGEgZm9yIFN5bmNocm9ub3VzIEZyb250IEVuZFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAg4oCLXG4gICAgY29uc3Qgc2VydmljZUZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnc2VydmljZUZ1bmN0aW9uJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdzZXJ2aWNlbGFtYmRhJyksXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM183LFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgXCJUQUJMRVwiOiB0YWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFwiQlVDS0VUXCI6IGltYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFwiUkVTSVpFREJVQ0tFVFwiOiByZXNpemVkQnVja2V0LmJ1Y2tldE5hbWVcbiAgICAgIH0sXG4gICAgfSk7XG4gICAg4oCLXG4gICAgaW1hZ2VCdWNrZXQuZ3JhbnRXcml0ZShzZXJ2aWNlRm4pO1xuICAgIHJlc2l6ZWRCdWNrZXQuZ3JhbnRXcml0ZShzZXJ2aWNlRm4pO1xuICAgIHRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzZXJ2aWNlRm4pO1xuICAgIFxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlndy5MYW1iZGFSZXN0QXBpKHRoaXMsICdpbWFnZUFQSScsIHtcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWd3LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ3cuQ29ycy5BTExfTUVUSE9EU1xuICAgICAgfSxcbiAgICAgIGhhbmRsZXI6IHNlcnZpY2VGbixcbiAgICAgIHByb3h5OiBmYWxzZSxcbiAgICB9KTtcbiAgICBcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gVGhpcyBjb25zdHJ1Y3QgYnVpbGRzIGEgbmV3IEFtYXpvbiBBUEkgR2F0ZXdheSB3aXRoIEFXUyBMYW1iZGEgSW50ZWdyYXRpb25cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3QgbGFtYmRhSW50ZWdyYXRpb24gPSBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24oc2VydmljZUZuLCB7XG4gICAgICBwcm94eTogZmFsc2UsXG4gICAgICByZXF1ZXN0UGFyYW1ldGVyczoge1xuICAgICAgICAnaW50ZWdyYXRpb24ucmVxdWVzdC5xdWVyeXN0cmluZy5hY3Rpb24nOiAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuYWN0aW9uJyxcbiAgICAgICAgJ2ludGVncmF0aW9uLnJlcXVlc3QucXVlcnlzdHJpbmcua2V5JzogJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmtleSdcbiAgICAgIH0sXG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7XG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogSlNPTi5zdHJpbmdpZnkoeyBhY3Rpb246IFwiJHV0aWwuZXNjYXBlSmF2YVNjcmlwdCgkaW5wdXQucGFyYW1zKCdhY3Rpb24nKSlcIiwga2V5OiBcIiR1dGlsLmVzY2FwZUphdmFTY3JpcHQoJGlucHV0LnBhcmFtcygna2V5JykpXCIgfSlcbiAgICAgIH0sXG4gICAgICBwYXNzdGhyb3VnaEJlaGF2aW9yOiBQYXNzdGhyb3VnaEJlaGF2aW9yLldIRU5fTk9fVEVNUExBVEVTLFxuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IFwiMjAwXCIsXG4gICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAvLyBXZSBjYW4gbWFwIHJlc3BvbnNlIHBhcmFtZXRlcnNcbiAgICAgICAgICAgIC8vIC0gRGVzdGluYXRpb24gcGFyYW1ldGVycyAodGhlIGtleSkgYXJlIHRoZSByZXNwb25zZSBwYXJhbWV0ZXJzICh1c2VkIGluIG1hcHBpbmdzKVxuICAgICAgICAgICAgLy8gLSBTb3VyY2UgcGFyYW1ldGVycyAodGhlIHZhbHVlKSBhcmUgdGhlIGludGVncmF0aW9uIHJlc3BvbnNlIHBhcmFtZXRlcnMgb3IgZXhwcmVzc2lvbnNcbiAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IFwiJyonXCJcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAvLyBGb3IgZXJyb3JzLCB3ZSBjaGVjayBpZiB0aGUgZXJyb3IgbWVzc2FnZSBpcyBub3QgZW1wdHksIGdldCB0aGUgZXJyb3IgZGF0YVxuICAgICAgICAgIHNlbGVjdGlvblBhdHRlcm46IFwiKFxcbnwuKStcIixcbiAgICAgICAgICBzdGF0dXNDb2RlOiBcIjUwMFwiLFxuICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogXCInKidcIlxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgXSxcbiAgICB9KTtcbiAgICBcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgQXV0aGVudGljYXRpb25cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3QgdXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCBcIlVzZXJQb29sXCIsIHtcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLCAvLyBBbGxvdyB1c2VycyB0byBzaWduIHVwXG4gICAgICBhdXRvVmVyaWZ5OiB7IGVtYWlsOiB0cnVlIH0sIC8vIFZlcmlmeSBlbWFpbCBhZGRyZXNzZXMgYnkgc2VuZGluZyBhIHZlcmlmaWNhdGlvbiBjb2RlXG4gICAgICBzaWduSW5BbGlhc2VzOiB7IHVzZXJuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSB9LCAvLyBTZXQgZW1haWwgYXMgYW4gYWxpYXNcbiAgICB9KTtcblxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgXCJVc2VyUG9vbENsaWVudFwiLCB7XG4gICAgICB1c2VyUG9vbCxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSwgLy8gRG9uJ3QgbmVlZCB0byBnZW5lcmF0ZSBzZWNyZXQgZm9yIHdlYiBhcHAgcnVubmluZyBvbiBicm93c2Vyc1xuICAgIH0pO1xuXG4gICAgY29uc3QgaWRlbnRpdHlQb29sID0gbmV3IGNvZ25pdG8uQ2ZuSWRlbnRpdHlQb29sKHRoaXMsIFwiSW1hZ2VSZWtvZ25pdGlvbklkZW50aXR5UG9vbFwiLCB7XG4gICAgICBhbGxvd1VuYXV0aGVudGljYXRlZElkZW50aXRpZXM6IGZhbHNlLCAvLyBEb24ndCBhbGxvdyB1bmF0aGVudGljYXRlZCB1c2Vyc1xuICAgICAgY29nbml0b0lkZW50aXR5UHJvdmlkZXJzOiBbXG4gICAgICAgIHtcbiAgICAgICAgY2xpZW50SWQ6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIHByb3ZpZGVyTmFtZTogdXNlclBvb2wudXNlclBvb2xQcm92aWRlck5hbWUsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXV0aCA9IG5ldyBhcGlndy5DZm5BdXRob3JpemVyKHRoaXMsICdBUElHYXRld2F5QXV0aG9yaXplcicsIHtcbiAgICAgIG5hbWU6ICdjdXN0b21lci1hdXRob3JpemVyJyxcbiAgICAgIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nLFxuICAgICAgcHJvdmlkZXJBcm5zOiBbdXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgICAgcmVzdEFwaUlkOiBhcGkucmVzdEFwaUlkLFxuICAgICAgdHlwZTogQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGF1dGhlbnRpY2F0ZWRSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIFwiSW1hZ2VSZWtvZ25pdGlvbkF1dGhlbnRpY2F0ZWRSb2xlXCIsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5GZWRlcmF0ZWRQcmluY2lwYWwoXG4gICAgICAgIFwiY29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tXCIsXG4gICAgICAgICAge1xuICAgICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICAgICBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphdWRcIjogaWRlbnRpdHlQb29sLnJlZixcbiAgICAgICAgICB9LFxuICAgICAgICAgIFwiRm9yQW55VmFsdWU6U3RyaW5nTGlrZVwiOiB7XG4gICAgICAgICAgICBcImNvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTphbXJcIjogXCJhdXRoZW50aWNhdGVkXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgXCJzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eVwiXG4gICAgICApLFxuICAgIH0pO1xuXG4gICAgLy8gSUFNIHBvbGljeSBncmFudGluZyB1c2VycyBwZXJtaXNzaW9uIHRvIHVwbG9hZCwgZG93bmxvYWQgYW5kIGRlbGV0ZSB0aGVpciBvd24gcGljdHVyZXNcbiAgICBhdXRoZW50aWNhdGVkUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwiczM6R2V0T2JqZWN0XCIsXG4gICAgICAgICAgXCJzMzpQdXRPYmplY3RcIlxuICAgICAgICBdLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGltYWdlQnVja2V0QXJuICsgXCIvcHJpdmF0ZS8ke2NvZ25pdG8taWRlbnRpdHkuYW1hem9uYXdzLmNvbTpzdWJ9LypcIixcbiAgICAgICAgICBpbWFnZUJ1Y2tldEFybiArIFwiL3ByaXZhdGUvJHtjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206c3VifVwiLFxuICAgICAgICAgIHJlc2l6ZWRCdWNrZXRBcm4gKyBcIi9wcml2YXRlLyR7Y29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOnN1Yn0vKlwiLFxuICAgICAgICAgIHJlc2l6ZWRCdWNrZXRBcm4gKyBcIi9wcml2YXRlLyR7Y29nbml0by1pZGVudGl0eS5hbWF6b25hd3MuY29tOnN1Yn1cIlxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gSUFNIHBvbGljeSBncmFudGluZyB1c2VycyBwZXJtaXNzaW9uIHRvIGxpc3QgdGhlaXIgcGljdHVyZXNcbiAgICBhdXRoZW50aWNhdGVkUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogW1wiczM6TGlzdEJ1Y2tldFwiXSxcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBpbWFnZUJ1Y2tldEFybixcbiAgICAgICAgICByZXNpemVkQnVja2V0QXJuXG4gICAgICAgIF0sXG4gICAgICAgIGNvbmRpdGlvbnM6IHtcIlN0cmluZ0xpa2VcIjoge1wiczM6cHJlZml4XCI6IFtcInByaXZhdGUvJHtjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206c3VifS8qXCJdfX1cbiAgICAgIH0pXG4gICAgKTtcblxuICAgIG5ldyBjb2duaXRvLkNmbklkZW50aXR5UG9vbFJvbGVBdHRhY2htZW50KHRoaXMsIFwiSWRlbnRpdHlQb29sUm9sZUF0dGFjaG1lbnRcIiwge1xuICAgICAgaWRlbnRpdHlQb29sSWQ6IGlkZW50aXR5UG9vbC5yZWYsXG4gICAgICByb2xlczogeyBhdXRoZW50aWNhdGVkOiBhdXRoZW50aWNhdGVkUm9sZS5yb2xlQXJuIH0sXG4gICAgfSk7XG5cbiAgICAvLyBFeHBvcnQgdmFsdWVzIG9mIENvZ25pdG9cbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiVXNlclBvb2xJZFwiLCB7XG4gICAgICB2YWx1ZTogdXNlclBvb2wudXNlclBvb2xJZCxcbiAgICB9KTtcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiQXBwQ2xpZW50SWRcIiwge1xuICAgICAgdmFsdWU6IHVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgfSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIklkZW50aXR5UG9vbElkXCIsIHtcbiAgICAgIHZhbHVlOiBpZGVudGl0eVBvb2wucmVmLFxuICAgIH0pO1xuXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3QgaW1hZ2VBUEkgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnaW1hZ2VzJyk7XG4gICAg4oCLXG4gICAgLy8gR0VUIC9pbWFnZXNcbiAgICBpbWFnZUFQSS5hZGRNZXRob2QoJ0dFVCcsIGxhbWJkYUludGVncmF0aW9uLCB7XG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcbiAgICAgIGF1dGhvcml6ZXI6IHsgYXV0aG9yaXplcklkOiBhdXRoLnJlZiB9LFxuICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnF1ZXJ5c3RyaW5nLmFjdGlvbic6IHRydWUsXG4gICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5rZXknOiB0cnVlXG4gICAgICB9LFxuICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiBcIjIwMFwiLFxuICAgICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICAgJ21ldGhvZC5yZXNwb25zZS5oZWFkZXIuQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogXCI1MDBcIixcbiAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuICAgIFxuICAgIC8vIERFTEVURSAvaW1hZ2VzXG4gICAgaW1hZ2VBUEkuYWRkTWV0aG9kKCdERUxFVEUnLCBsYW1iZGFJbnRlZ3JhdGlvbiwge1xuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IEF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXG4gICAgICBhdXRob3JpemVyOiB7IGF1dGhvcml6ZXJJZDogYXV0aC5yZWYgfSxcbiAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5hY3Rpb24nOiB0cnVlLFxuICAgICAgICAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcua2V5JzogdHJ1ZVxuICAgICAgfSxcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW1xuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogXCIyMDBcIixcbiAgICAgICAgICByZXNwb25zZVBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IFwiNTAwXCIsXG4gICAgICAgICAgcmVzcG9uc2VQYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgICAnbWV0aG9kLnJlc3BvbnNlLmhlYWRlci5BY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgICBcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQnVpbGRpbmcgU1FTIHF1ZXVlIGFuZCBEZWFkTGV0dGVyIFF1ZXVlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGRsUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdJbWFnZURMUXVldWUnLCB7XG4gICAgICBxdWV1ZU5hbWU6ICdJbWFnZURMUXVldWUnXG4gICAgfSlcbiAgICDigItcbiAgICBjb25zdCBxdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ0ltYWdlUXVldWUnLCB7XG4gICAgICBxdWV1ZU5hbWU6ICdJbWFnZVF1ZXVlJyxcbiAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICByZWNlaXZlTWVzc2FnZVdhaXRUaW1lOiBjZGsuRHVyYXRpb24uc2Vjb25kcygyMCksXG4gICAgICBkZWFkTGV0dGVyUXVldWU6IHtcbiAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiAyLFxuICAgICAgICBxdWV1ZTogZGxRdWV1ZVxuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBCdWlsZGluZyBTMyBCdWNrZXQgQ3JlYXRlIE5vdGlmaWNhdGlvbiB0byBTUVNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgaW1hZ2VCdWNrZXQuYWRkT2JqZWN0Q3JlYXRlZE5vdGlmaWNhdGlvbihuZXcgczNuLlNxc0Rlc3RpbmF0aW9uKHF1ZXVlKSwgeyBwcmVmaXg6ICdwcml2YXRlLycgfSlcbiAgXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIExhbWJkYShSZWtvZ25pdGlvbikgdG8gY29uc3VtZSBtZXNzYWdlcyBmcm9tIFNRU1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICByZWtGbi5hZGRFdmVudFNvdXJjZShuZXcgZXZlbnRfc291cmNlcy5TcXNFdmVudFNvdXJjZShxdWV1ZSkpO1xuICB9XG59XG4iXX0=