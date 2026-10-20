import { addSriHashes, signSecurityTxt } from "@dwk/eleventy-shared/postbuild";

const buildDir = "./dist";

// Workers Builds sets WORKERS_CI; the key must be a *build* secret there, not a runtime secret.
const isProductionCi = process.env.WORKERS_CI === "1" && process.env.WORKERS_CI_BRANCH === "main";

try {
  if (isProductionCi && !process.env.GPG_PRIVATE_KEY) {
    throw new Error("GPG_PRIVATE_KEY build secret is not set; refusing to deploy unsigned security.txt.");
  }
  await addSriHashes(buildDir);
  await signSecurityTxt(buildDir);
} catch (e) {
  console.error("Postbuild error:", e);
  process.exit(1);
}
