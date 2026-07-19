import {
  EC2Client,
  DescribeImagesCommand,
  DescribeInstancesCommand,
  DescribeSecurityGroupsCommand,
  DescribeVpcsCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  RunInstancesCommand,
} from '@aws-sdk/client-ec2';

const REGION = process.env.AWS_DEPLOY_REGION || 'ap-south-1';
const SECURITY_GROUP_NAME = 'neyla-deploy';
const INSTANCE_TYPE = process.env.AWS_DEPLOY_INSTANCE_TYPE || 't3.micro';

let client = null;

export function isAwsConfigured() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function getClient() {
  if (!client) {
    client = new EC2Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  return client;
}

async function findLatestAmi() {
  const res = await getClient().send(
    new DescribeImagesCommand({
      Owners: ['amazon'],
      Filters: [
        { Name: 'name', Values: ['al2023-ami-2023*-x86_64'] },
        { Name: 'state', Values: ['available'] },
        { Name: 'architecture', Values: ['x86_64'] },
      ],
    }),
  );

  const images = (res.Images || []).sort((a, b) => (b.CreationDate || '').localeCompare(a.CreationDate || ''));

  if (images.length === 0) {
    throw new Error('No Amazon Linux 2023 image found in this region');
  }

  return images[0].ImageId;
}

async function getDefaultVpcId() {
  const res = await getClient().send(
    new DescribeVpcsCommand({ Filters: [{ Name: 'is-default', Values: ['true'] }] }),
  );

  const vpc = res.Vpcs?.[0];

  if (!vpc) {
    throw new Error('No default VPC found in this region. Please create one or configure a VPC.');
  }

  return vpc.VpcId;
}

async function ensureSecurityGroup() {
  const ec2 = getClient();
  const vpcId = await getDefaultVpcId();

  const res = await ec2.send(
    new DescribeSecurityGroupsCommand({
      Filters: [
        { Name: 'group-name', Values: [SECURITY_GROUP_NAME] },
        { Name: 'vpc-id', Values: [vpcId] },
      ],
    }),
  );

  if (res.SecurityGroups && res.SecurityGroups.length > 0) {
    return res.SecurityGroups[0].GroupId;
  }

  const created = await ec2.send(
    new CreateSecurityGroupCommand({
      GroupName: SECURITY_GROUP_NAME,
      Description: 'Neyla published apps (HTTP)',
      VpcId: vpcId,
    }),
  );

  await ec2.send(
    new AuthorizeSecurityGroupIngressCommand({
      GroupId: created.GroupId,
      IpPermissions: [
        {
          IpProtocol: 'tcp',
          FromPort: 80,
          ToPort: 80,
          IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'HTTP' }],
        },
      ],
    }),
  );

  return created.GroupId;
}

export async function launchInstance({ name, userData }) {
  const ec2 = getClient();
  const [amiId, groupId] = await Promise.all([findLatestAmi(), ensureSecurityGroup()]);

  const res = await ec2.send(
    new RunInstancesCommand({
      ImageId: amiId,
      InstanceType: INSTANCE_TYPE,
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: [groupId],
      UserData: Buffer.from(userData, 'utf8').toString('base64'),
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: [
            { Key: 'Name', Value: name },
            { Key: 'neyla', Value: 'true' },
          ],
        },
      ],
    }),
  );

  return res.Instances[0].InstanceId;
}

export async function getInstanceState(instanceId) {
  const res = await getClient().send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
  const instance = res.Reservations?.[0]?.Instances?.[0];

  if (!instance) {
    return null;
  }

  return {
    state: instance.State?.Name,
    publicIp: instance.PublicIpAddress || null,
  };
}
