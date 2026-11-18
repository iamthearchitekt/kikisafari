# iPhone builds without a Mac

Apple's final build and signing step needs Xcode, which only runs on a Mac. **Unity Build Automation** runs that step
on a Mac in the cloud. You do everything else from Windows. The first setup takes an afternoon, plus Apple's 1–2 day
enrollment. After that, each code change reaches your iPhone in about an hour.

## 1. Apple Developer Program ($99 a year)

Enroll at developer.apple.com/programs/enroll with your Apple ID (two-factor sign-in on). Approval can take a day or
two, so start now.

## 2. A signing certificate, made on Windows

Git for Windows includes OpenSSL (`C:\Program Files\Git\usr\bin\openssl.exe`). In a folder **outside** the project
(these files are secrets):

```bash
openssl genrsa -out kiki.key 2048
```

```bash
openssl req -new -key kiki.key -out kiki.csr -subj "/emailAddress=YOUR_EMAIL/CN=YOUR NAME/C=US"
```

Then:

1. On developer.apple.com, go to **Certificates ▸ +** and choose **Apple Distribution**.
2. Upload `kiki.csr` and download `distribution.cer`.
3. Convert it and bundle it with the key (set a password when asked):

```bash
openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM
```

```bash
openssl pkcs12 -export -legacy -inkey kiki.key -in distribution.pem -out kiki-distribution.p12
```

(`-legacy` keeps the .p12 readable by the Mac that does the build.)

## 3. App ID, app record and provisioning profile

1. **Identifiers ▸ +** ▸ App IDs ▸ App. Use the explicit bundle ID `com.bigplush.kikisafari`. If you use a different
   one, also change it in Unity (Player Settings) and in `Editor/ProjectSetup.cs`. No extra capabilities are needed.
2. In **App Store Connect ▸ Apps ▸ +**, create a new iOS app. Name it KIKI SAFARI, pick the bundle ID above, and enter
   any SKU.
3. Go to **Profiles ▸ +** and choose **App Store Connect** (distribution). Pick the App ID and your certificate, then
   download the `.mobileprovision` file.

## 4. App Store Connect API key (for automatic TestFlight uploads)

In **App Store Connect ▸ Users and Access ▸ Integrations ▸ App Store Connect API**, generate a key with the App Manager
role. Download the `.p8` file (you can only download it once) and note the **Issuer ID** and **Key ID**.

## 5. Unity Build Automation

1. Push this project to a **private** Git repository (GitHub is fine).
2. In the Unity Cloud dashboard, open your project, then **DevOps ▸ Build Automation ▸ Set up**, and connect the repo.
3. Add an **iOS** build target:
   - Unity version: the 6000.0 version you use locally
   - Xcode: latest
   - Credentials: upload `kiki-distribution.p12`, its password and the `.mobileprovision`
   - Deploy: turn on **App Store Connect**, with the Issuer ID, Key ID and `.p8`
4. Start a build. It's charged per build minute; a clean build takes roughly 20–40 minutes.

The project already takes care of:

- the camera permission text
- iOS 15 or later, arm64 and ARKit
- marking the app as needing ARKit
- declaring no special encryption, so TestFlight doesn't stop to ask about it on every build

## 6. TestFlight

When the build reaches App Store Connect, it shows under **TestFlight** after Apple's processing (usually 10–30
minutes). Add yourself as an **internal tester**. Install the **TestFlight** app on the iPhone, accept the invite and
install KIKI SAFARI.

## 7. Playing your test build

1. Open KIKI SAFARI from the home screen and tap **Play**.
2. Allow the **camera**, and allow **location "While Using the App"**. Location is only used while the game is open.
3. **At home:** the first good GPS fix pins your test Rune Circle about 7 m in front of you, with a supply stop beside
   it and a Kiki wandering nearby. Turn around slowly and look for the column of purple light.
   - To move the circle: triple-tap the top-right corner (over the Rune Stone count) and choose
     **Move test Rune Circle here**.
4. **Catch:** walk within 40 m of a Kiki and tap it. Point the phone at the floor until Kiki pops up. Then flick the
   Rune Stone up from the bottom of the screen, or use **Tap to throw**.
5. **Refill:** tap a supply stop within 40 m for +5 Rune Stones. A stop restocks after 5 minutes.
6. **Rune Circle:** once you've caught a Kiki, tap the circle and choose **Begin the Spiral Rite**. Tap as each ring
   lands on the rune.
7. **Map:** tap **Map** for your real streets, with stops and circles at real landmarks nearby. Tap **Camera** to go
   back.
8. **Handy testing switches** in the tuning panel:
   - Force night, to see Moonbeam Kiki
   - Force Portal Surge
   - +30 stones
   - Throw strength, aim assist, catch odds and more

Safety: watch where you're going, and don't play while driving (the game also locks itself above about 30 km/h).

## Keeping round trips rare

- Do daily work in the Unity editor. Use XR Simulation for AR, or press Play for the meadow stage.
- Tune the throw on the phone with the hidden **tuning panel**: triple-tap the top-right corner. Changes save on the
  phone, with no rebuild.
- Optional: a used ARCore Android phone (around $100) installs over USB from Windows in minutes
  (File ▸ Build And Run). That makes tuning the feel of the throw much faster.

## Never commit

`.p12`, `.key`, `.csr`, `.cer`, `.mobileprovision`, `.p8`. The `.gitignore` blocks all of these.
Add `*.p8` too if you keep the key anywhere near the repo.
