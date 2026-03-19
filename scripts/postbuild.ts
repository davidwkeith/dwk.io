import { addSriHashes, signSecurityTxt } from "@dwk/eleventy-shared/postbuild";

const buildDir = "./dist";

try {
  await addSriHashes(buildDir);
  await signSecurityTxt(buildDir);
} catch (e) {
  console.error("Postbuild error:", e);
  process.exit(1);
}
