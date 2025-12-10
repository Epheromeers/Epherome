import { arch, type, version } from "@tauri-apps/plugin-os";

interface ClientJsonRuleOS {
  name?: string;
  version?: string;
  arch?: string;
}

interface ClientJsonRuleFeatures {
  is_demo_user?: boolean;
  has_custom_resolution?: boolean;
  has_quick_plays_support?: boolean;
  is_quick_play_singleplayer?: boolean;
  is_quick_play_multiplayer?: boolean;
  is_quick_play_realms?: boolean;
}

export interface ClientJsonRule {
  action: "allow" | "disallow";
  os?: ClientJsonRuleOS;
  features?: ClientJsonRuleFeatures;
}

function isOSCompliant(ruleOS: ClientJsonRuleOS) {
  const currentOS = type();
  const currentVersion = version();
  const currentArch = arch();
  const nameCompliance =
    !ruleOS.name ||
    currentOS === ruleOS.name ||
    (currentOS === "macos" && ruleOS.name === "osx");
  const versionCompliance =
    !ruleOS.version ||
    currentVersion.match(new RegExp(ruleOS.version)) !== null;
  const archCompliance =
    !ruleOS.arch ||
    currentArch === ruleOS.arch ||
    (currentArch === "x86_64" && ruleOS.arch === "x86");
  return nameCompliance && versionCompliance && archCompliance;
}

export function isCompliant(rule: ClientJsonRule) {
  const osCompliance = !rule.os || isOSCompliant(rule.os);
  const featuresCompliance = !rule.features; // TODO check features compliance
  const compliance = osCompliance && featuresCompliance;
  return rule.action === "allow" ? compliance : !compliance;
}

export function isAllCompliant(rules: ClientJsonRule[]) {
  for (const rule of rules) {
    if (!isCompliant(rule)) {
      return false;
    }
  }
  return true;
}
