import type { CapacitorConfig } from "@capacitor/cli";

// Personal mode allows an http:// API (e.g. your PC on the home Wi-Fi: http://192.168.1.20:4000).
// For a public Play Store release, build with CAP_ALLOW_HTTP=false and use an https API.
const allowHttp = process.env.CAP_ALLOW_HTTP !== "false";

const config: CapacitorConfig = {
  appId: "com.habitflow.app",
  appName: "HabitFlow",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: allowHttp,
  },
  android: {
    backgroundColor: "#120e0d",
    allowMixedContent: allowHttp,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_habitflow",
      iconColor: "#f0873a",
    },
  },
};

export default config;
