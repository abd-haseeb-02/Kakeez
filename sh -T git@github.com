[33mcommit ce84e73156f370b8bd46b6e9caa98c09f2809f3e[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmaster[m[33m)[m
Author: Abdul Haseeb Saad <absaad2002@gmail.com>
Date:   Tue Jun 16 01:50:19 2026 +0500

    Initial commit

[1mdiff --git a/.gitignore b/.gitignore[m
[1mindex 5ef6a52..2048693 100644[m
[1m--- a/.gitignore[m
[1m+++ b/.gitignore[m
[36m@@ -1,14 +1,7 @@[m
[31m-# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.[m
[31m-[m
 # dependencies[m
 /node_modules[m
 /.pnp[m
 .pnp.*[m
[31m-.yarn/*[m
[31m-!.yarn/patches[m
[31m-!.yarn/plugins[m
[31m-!.yarn/releases[m
[31m-!.yarn/versions[m
 [m
 # testing[m
 /coverage[m
[36m@@ -23,6 +16,8 @@[m
 # misc[m
 .DS_Store[m
 *.pem[m
[32m+[m[32mThumbs.db[m
[32m+[m[32mdesktop.ini[m
 [m
 # debug[m
 npm-debug.log*[m
[36m@@ -30,8 +25,9 @@[m [myarn-debug.log*[m
 yarn-error.log*[m
 .pnpm-debug.log*[m
 [m
[31m-# env files (can opt-in for committing if needed)[m
[31m-.env*[m
[32m+[m[32m# local env files[m
[32m+[m[32m.env*.local[m
[32m+[m[32m.env.local[m
 [m
 # vercel[m
 .vercel[m
[36m@@ -39,3 +35,6 @@[m [myarn-error.log*[m
 # typescript[m
 *.tsbuildinfo[m
 next-env.d.ts[m
[32m+[m
[32m+[m[32m# supabase logs[m
[32m+[m[32msupabase/.temp[m
[1mdiff --git a/next.config.ts b/next.config.ts[m
[1mdeleted file mode 100644[m
[1mindex e9ffa30..0000000[m
[1m--- a/next.config.ts[m
[1m+++ /dev/null[m
[36m@@ -1,7 +0,0 @@[m
[31m-import type { NextConfig } from "next";[m
[31m-[m
[31m-const nextConfig: NextConfig = {[m
[31m-  /* config options here */[m
[31m-};[m
[31m-[m
[31m-export default nextConfig;[m
[1mdiff --git a/package-lock.json b/package-lock.json[m
[1mindex 4104cbf..963e652 100644[m
[1m--- a/package-lock.json[m
[1m+++ b/package-lock.json[m
[36m@@ -8,9 +8,15 @@[m
       "name": "kakeez-app",[m
       "version": "0.1.0",[m
       "dependencies": {[m
[32m+[m[32m        "@supabase/supabase-js": "^2.108.2",[m
[32m+[m[32m        "clsx": "^2.1.1",[m
[32m+[m[32m        "dotenv": "^17.4.2",[m
[32m+[m[32m        "lucide-react": "^1.18.0",[m
         "next": "16.2.9",[m
         "react": "19.2.4",[m
[31m-        "react-dom": "19.2.4"[m
[32m+[m[32m        "react-dom": "19.2.4",[m
[32m+[m[32m        "tailwind-merge": "^3.6.0",[m
[32m+[m[32m        "zustand": "^5.0.14"[m
       },[m
       "devDependencies": {[m
         "@tailwindcss/postcss": "^4",[m
[36m@@ -1313,6 +1319,90 @@[m
       "dev": true,[m
       "license": "MIT"[m
     },[m
[32m+[m[32m    "node_modules/@supabase/auth-js": {[m
[32m+[m[32m      "version": "2.108.2",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/@supabase/auth-js/-/auth-js-2.108.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-tNaQmBgodDZwgB40mRwVbxFy8IDYwjdpcZ0BYrWiwlULCSQoJj4QoG4zgJT7QRPXcqipefNOzvO/qAu4dF98ag==",[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "tslib": "2.8.1"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=20.0.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@supabase/functions-js": {[m
[32m+[m[32m      "version": "2.108.2",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/@supabase/functions-js/-/functions-js-2.108.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-RNUX8EiBy3iLwAX19jtRzLyePnl11/fHcgwDHLnpKcDSXt/5qBnh3LUwAtIjT21Q66QsmNUR2esrHziLCpNubw==",[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "tslib": "2.8.1"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=20.0.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@supabase/phoenix": {[m
[32m+[m[32m      "version": "0.4.2",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/@supabase/phoenix/-/phoenix-0.4.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-YSAGnmDAfuleFCVt3CeurQZAhxRfXWeZIIkwp7NhYzQ1UwW6ePSnzsFAiUm/mbCkfoCf70QQHKW/K6RKh52a4A==",[m
[32m+[m[32m      "license": "MIT"[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@supabase/postgrest-js": {[m
[32m+[m[32m      "version": "2.108.2",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/@supabase/postgrest-js/-/postgrest-js-2.108.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-GQ28/Y8hk3CFmkb3kXH1h/AQx6JIYSQfO0CJMRVBcEKZoNy6C45cXAZ4fcJvRC5Id0cs6xnkUV0+c0rIocigsw==",[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "tslib": "2.8.1"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=20.0.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@supabase/realtime-js": {[m
[32m+[m[32m      "version": "2.108.2",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/@supabase/realtime-js/-/realtime-js-2.108.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-aAGxCSUemZvQIibnCdvNvgaKib28I4rfrNjKbQ9cG1uBLwUsI7hVpGXgEbypCCDhLjQlDTAiJlu7rgljYUT73g==",[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@supabase/phoenix": "^0.4.2",[m
[32m+[m[32m        "tslib": "2.8.1"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=20.0.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@supabase/storage-js": {[m
[32m+[m[32m      "version": "2.108.2",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/@supabase/storage-js/-/storage-js-2.108.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-TVZPQxXGxY2+A6yTtm77zUHsh70lBhYUEaJL8RQC+BghcX/ygiMG/rmXrNVBce30/WAeNPa8FiG8HbqlGeV05g==",[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "iceberg-js": "^0.8.1",[m
[32m+[m[32m        "tslib": "2.8.1"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=20.0.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@supabase/supabase-js": {[m
[32m+[m[32m      "version": "2.108.2",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-2.108.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-hFhnPveb5JQg4a0QYicM0swT253YHMdfeRAl2BKHOlI5VAzuHxUGSr8RbwNLYNPauWOgQMS1H8sz8bvYlgwUfQ==",[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@supabase/auth-js": "2.108.2",[m
[32m+[m[32m        "@supabase/functions-js": "2.108.2",[m
[32m+[m[32m        "@supabase/postgrest-js": "2.108.2",[m
[32m+[m[32m        "@supabase/realtime-js": "2.108.2",[m
[32m+[m[32m        "@supabase/storage-js": "2.108.2"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=20.0.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/@swc/helpers": {[m
       "version": "0.5.15",[m
       "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.15.tgz",[m
[36m@@ -1651,7 +1741,7 @@[m
       "version": "19.2.17",[m
       "resolved": "https://registry.npmjs.org/@types/react/-/react-19.2.17.tgz",[m
       "integrity": "sha512-MXfmqaVPEVgkBT/aY0aGCkRWWtByiYQXo3xdQ8r5RzuFrPiRn8Gar2tQdXSUQ2GKV3bkXckek89V8wQBY2Q/Aw==",[m
[31m-      "dev": true,[m
[32m+[m[32m      "devOptional": true,[m
       "license": "MIT",[m
       "dependencies": {[m
         "csstype": "^3.2.2"[m
[36m@@ -2782,6 +2872,15 @@[m
       "integrity": "sha512-IV3Ou0jSMzZrd3pZ48nLkT9DA7Ag1pnPzaiQhpW7c3RbcqqzvzzVu+L8gfqMp/8IM2MQtSiqaCxrrcfu8I8rMA==",[m
       "license": "MIT"[m
     },[m
[32m+[m[32m    "node_modules/clsx": {[m
[32m+[m[32m      "version": "2.1.1",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/clsx/-/clsx-2.1.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-eYm0QWBtUrBWZWG0d386OGAw16Z995PiOVo2B7bjWSbHedGl5e0ZW