"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsdevhourBackendPipelineStack = void 0;
const codepipeline = require("@aws-cdk/aws-codepipeline");
const codepipeline_actions = require("@aws-cdk/aws-codepipeline-actions");
const core_1 = require("@aws-cdk/core");
const pipelines_1 = require("@aws-cdk/pipelines");
const awsdevhour_backend_pipeline_stage_1 = require("./awsdevhour-backend-pipeline-stage");
const aws_ssm_1 = require("@aws-cdk/aws-ssm");
/**
 * Test
 * Stack to define the Devhour-series1 application pipeline
 *
 * Prerequisite:
 *  Github personal access token should be stored in Secret Manager with id as below
 *  Github owner value should be set up in System manager - Parameter store with name as below
 *  Github repository value should be set up in System manager - Parameter store with name as below
 *  Github branch value should be set up in System manager - Parameter store with name as below
 * */
class AwsdevhourBackendPipelineStack extends core_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const sourceArtifact = new codepipeline.Artifact();
        const cloudAssemblyArtifact = new codepipeline.Artifact();
        const githubOwner = aws_ssm_1.StringParameter.fromStringParameterAttributes(this, 'gitOwner', {
            parameterName: 'devhour-backend-git-owner'
        }).stringValue;
        const githubRepo = aws_ssm_1.StringParameter.fromStringParameterAttributes(this, 'gitRepo', {
            parameterName: 'devhour-backend-git-repo'
        }).stringValue;
        const githubBranch = aws_ssm_1.StringParameter.fromStringParameterAttributes(this, 'gitBranch', {
            parameterName: 'devhour-backend-git-branch'
        }).stringValue;
        const pipeline = new pipelines_1.CdkPipeline(this, 'Pipeline', {
            crossAccountKeys: false,
            cloudAssemblyArtifact,
            // Define application source
            sourceAction: new codepipeline_actions.GitHubSourceAction({
                actionName: 'GitHub',
                output: sourceArtifact,
                oauthToken: core_1.SecretValue.secretsManager('devhour-backend-git-access-token', { jsonField: 'devHourSeries1-git-access-token' }),
                owner: githubOwner,
                repo: githubRepo,
                branch: githubBranch
            }),
            // Define build and synth commands
            synthAction: pipelines_1.SimpleSynthAction.standardNpmSynth({
                sourceArtifact,
                cloudAssemblyArtifact,
                buildCommand: 'rm -rf ./reklayer/* && wget https://awsdevhour.s3-accelerate.amazonaws.com/pillow.zip && unzip pillow.zip && mv ./python ./reklayer && rm pillow.zip && npm run build',
                synthCommand: 'npm run cdk synth'
            })
        });
        //Define application stage
        const stage = pipeline.addApplicationStage(new awsdevhour_backend_pipeline_stage_1.AwsdevhourBackendPipelineStage(this, 'dev'));
        // stage.addActions(new ManualApprovalAction({
        //   actionName: 'ManualApproval',
        //   runOrder: stage.nextSequentialRunOrder(),
        // }));
    }
}
exports.AwsdevhourBackendPipelineStack = AwsdevhourBackendPipelineStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzZGV2aG91ci1iYWNrZW5kLXBpcGVsaW5lLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXdzZGV2aG91ci1iYWNrZW5kLXBpcGVsaW5lLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDBEQUEwRDtBQUMxRCwwRUFBMEU7QUFDMUUsd0NBQTBFO0FBQzFFLGtEQUF1RjtBQUN2RiwyRkFBcUY7QUFDckYsOENBQW1EO0FBR25EOzs7Ozs7Ozs7S0FTSztBQUVMLE1BQWEsOEJBQStCLFNBQVEsWUFBSztJQUN2RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQzFELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sY0FBYyxHQUFHLElBQUksWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ25ELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFMUQsTUFBTSxXQUFXLEdBQUcseUJBQWUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFDO1lBQ2pGLGFBQWEsRUFBRSwyQkFBMkI7U0FDM0MsQ0FBQyxDQUFDLFdBQVcsQ0FBQztRQUVmLE1BQU0sVUFBVSxHQUFHLHlCQUFlLENBQUMsNkJBQTZCLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBQztZQUMvRSxhQUFhLEVBQUUsMEJBQTBCO1NBQzFDLENBQUMsQ0FBQyxXQUFXLENBQUM7UUFFZixNQUFNLFlBQVksR0FBRyx5QkFBZSxDQUFDLDZCQUE2QixDQUFDLElBQUksRUFBRSxXQUFXLEVBQUM7WUFDbkYsYUFBYSxFQUFFLDRCQUE0QjtTQUM1QyxDQUFDLENBQUMsV0FBVyxDQUFDO1FBRWYsTUFBTSxRQUFRLEdBQUcsSUFBSSx1QkFBVyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDakQsZ0JBQWdCLEVBQUUsS0FBSztZQUN2QixxQkFBcUI7WUFDckIsNEJBQTRCO1lBQzVCLFlBQVksRUFBRSxJQUFJLG9CQUFvQixDQUFDLGtCQUFrQixDQUFDO2dCQUN4RCxVQUFVLEVBQUUsUUFBUTtnQkFDcEIsTUFBTSxFQUFFLGNBQWM7Z0JBQ3RCLFVBQVUsRUFBRSxrQkFBVyxDQUFDLGNBQWMsQ0FBQyxrQ0FBa0MsRUFBRSxFQUFDLFNBQVMsRUFBRSxpQ0FBaUMsRUFBQyxDQUFDO2dCQUMxSCxLQUFLLEVBQUUsV0FBVztnQkFDbEIsSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLE1BQU0sRUFBRSxZQUFZO2FBQ3JCLENBQUM7WUFDRixrQ0FBa0M7WUFDbEMsV0FBVyxFQUFFLDZCQUFpQixDQUFDLGdCQUFnQixDQUFDO2dCQUM5QyxjQUFjO2dCQUNkLHFCQUFxQjtnQkFDckIsWUFBWSxFQUFFLHVLQUF1SztnQkFDckwsWUFBWSxFQUFFLG1CQUFtQjthQUNsQyxDQUFDO1NBQ0gsQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLGtFQUE4QixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBRTVGLDhDQUE4QztRQUM5QyxrQ0FBa0M7UUFDbEMsOENBQThDO1FBQzlDLE9BQU87SUFFVCxDQUFDO0NBQ0Y7QUFqREQsd0VBaURDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY29kZXBpcGVsaW5lIGZyb20gJ0Bhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmUnO1xuaW1wb3J0ICogYXMgY29kZXBpcGVsaW5lX2FjdGlvbnMgZnJvbSAnQGF3cy1jZGsvYXdzLWNvZGVwaXBlbGluZS1hY3Rpb25zJztcbmltcG9ydCB7IENvbnN0cnVjdCwgU2VjcmV0VmFsdWUsIFN0YWNrLCBTdGFja1Byb3BzIH0gZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgeyBDZGtQaXBlbGluZSwgU2ltcGxlU3ludGhBY3Rpb24sIFNoZWxsU2NyaXB0QWN0aW9uIH0gZnJvbSBcIkBhd3MtY2RrL3BpcGVsaW5lc1wiO1xuaW1wb3J0IHsgQXdzZGV2aG91ckJhY2tlbmRQaXBlbGluZVN0YWdlIH0gZnJvbSBcIi4vYXdzZGV2aG91ci1iYWNrZW5kLXBpcGVsaW5lLXN0YWdlXCI7XG5pbXBvcnQgeyBTdHJpbmdQYXJhbWV0ZXIgfSBmcm9tICdAYXdzLWNkay9hd3Mtc3NtJztcbmltcG9ydCB7IE1hbnVhbEFwcHJvdmFsQWN0aW9uIH0gZnJvbSAnQGF3cy1jZGsvYXdzLWNvZGVwaXBlbGluZS1hY3Rpb25zJztcblxuLyoqXG4gKiBUZXN0XG4gKiBTdGFjayB0byBkZWZpbmUgdGhlIERldmhvdXItc2VyaWVzMSBhcHBsaWNhdGlvbiBwaXBlbGluZVxuICpcbiAqIFByZXJlcXVpc2l0ZTpcbiAqICBHaXRodWIgcGVyc29uYWwgYWNjZXNzIHRva2VuIHNob3VsZCBiZSBzdG9yZWQgaW4gU2VjcmV0IE1hbmFnZXIgd2l0aCBpZCBhcyBiZWxvd1xuICogIEdpdGh1YiBvd25lciB2YWx1ZSBzaG91bGQgYmUgc2V0IHVwIGluIFN5c3RlbSBtYW5hZ2VyIC0gUGFyYW1ldGVyIHN0b3JlIHdpdGggbmFtZSBhcyBiZWxvd1xuICogIEdpdGh1YiByZXBvc2l0b3J5IHZhbHVlIHNob3VsZCBiZSBzZXQgdXAgaW4gU3lzdGVtIG1hbmFnZXIgLSBQYXJhbWV0ZXIgc3RvcmUgd2l0aCBuYW1lIGFzIGJlbG93XG4gKiAgR2l0aHViIGJyYW5jaCB2YWx1ZSBzaG91bGQgYmUgc2V0IHVwIGluIFN5c3RlbSBtYW5hZ2VyIC0gUGFyYW1ldGVyIHN0b3JlIHdpdGggbmFtZSBhcyBiZWxvd1xuICogKi9cblxuZXhwb3J0IGNsYXNzIEF3c2RldmhvdXJCYWNrZW5kUGlwZWxpbmVTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG4gIFxuICAgIGNvbnN0IHNvdXJjZUFydGlmYWN0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgpO1xuICAgIGNvbnN0IGNsb3VkQXNzZW1ibHlBcnRpZmFjdCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcbiAgXG4gICAgY29uc3QgZ2l0aHViT3duZXIgPSBTdHJpbmdQYXJhbWV0ZXIuZnJvbVN0cmluZ1BhcmFtZXRlckF0dHJpYnV0ZXModGhpcywgJ2dpdE93bmVyJyx7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnZGV2aG91ci1iYWNrZW5kLWdpdC1vd25lcidcbiAgICB9KS5zdHJpbmdWYWx1ZTtcbiAgXG4gICAgY29uc3QgZ2l0aHViUmVwbyA9IFN0cmluZ1BhcmFtZXRlci5mcm9tU3RyaW5nUGFyYW1ldGVyQXR0cmlidXRlcyh0aGlzLCAnZ2l0UmVwbycse1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2RldmhvdXItYmFja2VuZC1naXQtcmVwbydcbiAgICB9KS5zdHJpbmdWYWx1ZTtcbiAgXG4gICAgY29uc3QgZ2l0aHViQnJhbmNoID0gU3RyaW5nUGFyYW1ldGVyLmZyb21TdHJpbmdQYXJhbWV0ZXJBdHRyaWJ1dGVzKHRoaXMsICdnaXRCcmFuY2gnLHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdkZXZob3VyLWJhY2tlbmQtZ2l0LWJyYW5jaCdcbiAgICB9KS5zdHJpbmdWYWx1ZTtcbiAgICBcbiAgICBjb25zdCBwaXBlbGluZSA9IG5ldyBDZGtQaXBlbGluZSh0aGlzLCAnUGlwZWxpbmUnLCB7XG4gICAgICBjcm9zc0FjY291bnRLZXlzOiBmYWxzZSxcbiAgICAgIGNsb3VkQXNzZW1ibHlBcnRpZmFjdCxcbiAgICAgIC8vIERlZmluZSBhcHBsaWNhdGlvbiBzb3VyY2VcbiAgICAgIHNvdXJjZUFjdGlvbjogbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkdpdEh1YlNvdXJjZUFjdGlvbih7XG4gICAgICAgIGFjdGlvbk5hbWU6ICdHaXRIdWInLFxuICAgICAgICBvdXRwdXQ6IHNvdXJjZUFydGlmYWN0LFxuICAgICAgICBvYXV0aFRva2VuOiBTZWNyZXRWYWx1ZS5zZWNyZXRzTWFuYWdlcignZGV2aG91ci1iYWNrZW5kLWdpdC1hY2Nlc3MtdG9rZW4nLCB7anNvbkZpZWxkOiAnZGV2SG91clNlcmllczEtZ2l0LWFjY2Vzcy10b2tlbid9KSwgLy8gdGhpcyB0b2tlbiBpcyBzdG9yZWQgaW4gU2VjcmV0IE1hbmFnZXJcbiAgICAgICAgb3duZXI6IGdpdGh1Yk93bmVyLFxuICAgICAgICByZXBvOiBnaXRodWJSZXBvLFxuICAgICAgICBicmFuY2g6IGdpdGh1YkJyYW5jaFxuICAgICAgfSksXG4gICAgICAvLyBEZWZpbmUgYnVpbGQgYW5kIHN5bnRoIGNvbW1hbmRzXG4gICAgICBzeW50aEFjdGlvbjogU2ltcGxlU3ludGhBY3Rpb24uc3RhbmRhcmROcG1TeW50aCh7XG4gICAgICAgIHNvdXJjZUFydGlmYWN0LFxuICAgICAgICBjbG91ZEFzc2VtYmx5QXJ0aWZhY3QsXG4gICAgICAgIGJ1aWxkQ29tbWFuZDogJ3JtIC1yZiAuL3Jla2xheWVyLyogJiYgd2dldCBodHRwczovL2F3c2RldmhvdXIuczMtYWNjZWxlcmF0ZS5hbWF6b25hd3MuY29tL3BpbGxvdy56aXAgJiYgdW56aXAgcGlsbG93LnppcCAmJiBtdiAuL3B5dGhvbiAuL3Jla2xheWVyICYmIHJtIHBpbGxvdy56aXAgJiYgbnBtIHJ1biBidWlsZCcsXG4gICAgICAgIHN5bnRoQ29tbWFuZDogJ25wbSBydW4gY2RrIHN5bnRoJ1xuICAgICAgfSlcbiAgICB9KTtcbiAgICBcbiAgICAvL0RlZmluZSBhcHBsaWNhdGlvbiBzdGFnZVxuICAgIGNvbnN0IHN0YWdlID0gcGlwZWxpbmUuYWRkQXBwbGljYXRpb25TdGFnZShuZXcgQXdzZGV2aG91ckJhY2tlbmRQaXBlbGluZVN0YWdlKHRoaXMsICdkZXYnKSk7XG5cbiAgICAvLyBzdGFnZS5hZGRBY3Rpb25zKG5ldyBNYW51YWxBcHByb3ZhbEFjdGlvbih7XG4gICAgLy8gICBhY3Rpb25OYW1lOiAnTWFudWFsQXBwcm92YWwnLFxuICAgIC8vICAgcnVuT3JkZXI6IHN0YWdlLm5leHRTZXF1ZW50aWFsUnVuT3JkZXIoKSxcbiAgICAvLyB9KSk7XG5cbiAgfVxufVxuIl19