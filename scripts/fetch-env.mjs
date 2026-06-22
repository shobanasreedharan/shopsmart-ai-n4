import { execSync } from "node:child_process"

const PROJECT = "prj_OgYreWQ9vfE5U2l11PxYTT43BF3g"
const SCOPE = "team_JKbMASqqAXGSPwbTLSDYeU0u"
const WANT = [
  "AWS_REGION",
  "AWS_ROLE_ARN",
  "DYNAMODB_TABLE_NAME",
  "DYNAMODB_TABLE_PARTITION_KEY",
  "DYNAMODB_TABLE_SORT_KEY",
]

function api(path) {
  const out = execSync(`vercel api "${path}" --scope ${SCOPE} 2>/dev/null`, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  return JSON.parse(out)
}

const list = api(`/v9/projects/${PROJECT}/env`)
const envs = list.envs || list
const lines = []
for (const key of WANT) {
  const match = envs.find((e) => e.key === key)
  if (!match) {
    console.error("MISSING on project:", key)
    continue
  }
  const full = api(`/v1/projects/${PROJECT}/env/${match.id}`)
  lines.push(`${key}=${full.value}`)
  console.error("got", key, "=", full.value)
}
console.log("---VALUES---")
console.log(lines.join("\n"))
