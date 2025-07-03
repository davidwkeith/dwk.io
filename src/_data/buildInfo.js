import childProcess from 'node:child_process';

const latestGitCommitHash =
    childProcess
    .execSync('git rev-parse --short HEAD')
    .toString()
    .trim();

export default {
  hash: latestGitCommitHash,
};