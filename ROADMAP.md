# SecurePass Roadmap
This document outlines future enhancements and "nice-to-have" features that are optional but recommended for a complete enterprise-grade product.

## 🔒 Security Enhancements
- [ ] **Client-Side Only Mode**: Allow users to opt-in for zero-knowledge encryption where the key is derived solely from the password on the client side. Note: "Forgot Password" will result in permanent data loss for these users.
- [ ] **WebAuthn / Biometrics**: Integrate platform authenticators (FaceID, TouchID, Windows Hello) for device-level unlocking to avoid typing the master password repeatedly.
- [ ] **Breach Monitoring**: Integrate with HaveIBeenPwned API to check if saved credentials have appeared in known data breaches.

## ☁️ Integrations
- [ ] **Cloud Backup**: Allow users to export their encrypted vault directly to Google Drive or Dropbox.
- [ ] **Browser Extension**: Build a Chrome/Edge extension to auto-fill passwords on websites.

## ⚡ Performance & Reliability
- [ ] **Background Jobs**: Implement a nightly job (e.g., using BullMQ) to re-calculate password health scores and email users a security summary.
- [ ] **E2E Testing**: Add Playwright tests to automate the full browser-based user flow (login -> save -> verify).

## 📱 Mobile
- [ ] **PWA Support**: Enhance the web app manifest and service workers for a better "Add to Home Screen" experience on mobile.
