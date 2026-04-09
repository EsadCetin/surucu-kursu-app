import Constants from "expo-constants";
import { LogLevel, OneSignal } from "react-native-onesignal";

type PushProfile = {
  tc: string;
  sinif?: string;
  durum?: string;
  evrakDurumu?: string;
};

let initialized = false;

function getOneSignalAppId() {
  const appId =
    Constants.expoConfig?.extra?.oneSignalAppId ||
    process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ||
    "fb327fa5-7e9b-411b-b4fa-3217462cde7b";

  return typeof appId === "string" ? appId.trim() : "";
}

export function initializeOneSignal() {
  if (initialized) return;

  const appId = getOneSignalAppId();
  if (!appId) {
    console.log("OneSignal App ID tanımlı değil.");
    return;
  }

  OneSignal.Debug.setLogLevel(__DEV__ ? LogLevel.Verbose : LogLevel.None);
  OneSignal.initialize(appId);
  initialized = true;
}

export async function syncStudentPushProfile(profile: PushProfile) {
  if (!profile.tc?.trim()) return;

  initializeOneSignal();

  const appId = getOneSignalAppId();
  if (!appId) return;

  await OneSignal.login(profile.tc.trim());

  await OneSignal.User.addTags({
    tc: profile.tc.trim(),
    sinif: profile.sinif?.trim() || "",
    durum: profile.durum?.trim() || "",
    evrak_durumu: profile.evrakDurumu?.trim() || "",
  });

  await OneSignal.Notifications.requestPermission(true);
}

export async function clearStudentPushProfile() {
  initializeOneSignal();

  const appId = getOneSignalAppId();
  if (!appId) return;

  await OneSignal.logout();
}
