import { Fn, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { GithubEcrPipeline } from "./constructs/github-ecr-pipeline-construct/github-ecr-construct";

export interface PipelineStackProps extends StackProps {
  branchName: string;
}

export class PipelinesStack extends Stack {
  constructor(scope: Construct, id: string, props?: PipelineStackProps) {
    super(scope, id, props);

    const { branchName } = props!;

    const repositoryName = Fn.importValue("ds-marketplace-repository");

    const repository = ecr.Repository.fromRepositoryName(
      this,
      "ecrRepository",
      repositoryName
    );

    const bucketName = Fn.importValue("artifact-bucket");

    const bucket = s3.Bucket.fromBucketName(this, "s3-bucket", bucketName);

    const pipeline = new GithubEcrPipeline(this, "GithubEcrCodePipeline", {
      ecrRepository: repository,
      githubRepo: "marketplace-client",
      branchName: branchName,
      directoryName: "services",
      artifactBucket: bucket,
    });
  }
}
