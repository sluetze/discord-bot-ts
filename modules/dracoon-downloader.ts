import https from "node:https";

export function getFromDracoon(secret: string, downloadToken: string, cb) {
  const data = JSON.stringify({
    password: secret,
  });

  const options = {
    hostname: "dracoon.team",
    port: 443,
    path: `/api/v4/public/shares/downloads/${downloadToken}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  const request = https.request(options, response => {
    response.on("data", chunk => {
      const downloadUrl = JSON.parse(chunk).downloadUrl;
      https.get(downloadUrl, response => {
        const data = [];
        response.on("data", chunk => {
          data.push(chunk);
        }).on("end", () => {
          const buffer = Buffer.concat(data);
          cb(buffer);
        });
      }).on("error", error => {
        console.log("download error:", error);
      });
    });
  });
  request.on("error", error => {
    console.error(error);
  });
  request.write(data);
  request.end();
}
