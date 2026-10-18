import type { CapacitorConfig } from "@capacitor/cli";

// The native apps load the live site so every web update reaches phones instantly.
const config: CapacitorConfig = {
  appId: "com.pinkwheelpk.app",
  appName: "Pink Wheel",
  webDir: "mobile-shell",
  server: {
    url: "https://pinkwheelpk.com",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#FDF2F6",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#FDF2F6",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
