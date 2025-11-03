const originalWrite = process.stderr.write.bind(process.stderr);

process.stderr.write = function patchedStderrWrite(chunk, encoding, callback) {
  const text = typeof chunk === "string" ? chunk : chunk.toString(encoding ?? "utf8");

  if (text.includes("legacy JS API is deprecated") && text.includes("sass-lang.com/d/legacy-js-api")) {
    return true;
  }

  return originalWrite(chunk, encoding, callback);
};
