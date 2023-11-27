import { Construct, Stack, StackProps } from '@aws-cdk/core';
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
export declare class AwsdevhourBackendPipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps);
}
