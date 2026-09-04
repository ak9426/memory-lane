# Memory Lane

A single-page site where anyone can pin up a nostalgic memory — a name, a story, and an optional photo. No login. Everyone sees everyone's posts, live.

It's a static site (HTML/CSS/JS), which is what Netlify hosts. The "dynamic, stored, shared by everyone" part comes from **Firebase Firestore** — a free database that your browser talks to directly, no server code required. You need to connect your own free Firebase project before this will work; it takes about 5 minutes.

## Files

- `index.html` — the page structure
- `style.css` — the corkboard/pinned-photo look
- `app.js` — form handling, image compression, live feed
- `firebase-config.js` — **you edit this one** with your project's keys

## 1. Create a free Firebase project (~5 min)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account.
2. Click **Add project**, give it any name (e.g. "memory-lane"), and finish the wizard (you can skip Google Analytics).
3. In the left sidebar, click **Build → Firestore Database → Create database**.
   - Choose **Start in production mode**.
   - Pick any region close to you.
4. Once created, go to the **Rules** tab of Firestore and replace the contents with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /memories/{memoryId} {
         allow read: if true;
         allow create: if
           request.resource.data.name is string &&
           request.resource.data.name.size() <= 40 &&
           request.resource.data.story is string &&
           request.resource.data.story.size() > 0 &&
           request.resource.data.story.size() <= 1200 &&
           (request.resource.data.photo == null || request.resource.data.photo.size() < 1000000);
         allow update, delete: if false;
       }
     }
   }
   ```

   This lets anyone read and post (matching "no login required"), but blocks edits/deletes from the browser and rejects oversized or malformed posts. Click **Publish**.

5. Back in the project overview, click the **</> (Web)** icon to register a web app. Give it any nickname and click **Register app** — you don't need Firebase Hosting.
6. Firebase will show you a config object like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "memory-lane-xxxxx.firebaseapp.com",
     projectId: "memory-lane-xxxxx",
     storageBucket: "memory-lane-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

   Copy those six values into `firebase-config.js` in this folder, replacing the placeholders.

That's it for the backend — no billing, no server, all on Firebase's free Spark tier (plenty for a personal or small community project; it comfortably handles tens of thousands of reads/writes a day).

## 2. Test it locally (optional)

Open `index.html` directly in a browser, or serve the folder locally:

```bash
npx serve .
```

Try posting a memory — it should appear instantly, and if you open the page in a second tab it should show up there too.

## 3. Deploy to Netlify

**Easiest way (drag and drop):**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the whole `memory-lane` folder (with your edited `firebase-config.js`) onto the page.
3. Netlify gives you a live URL immediately.

**Or via Git (recommended if you'll keep editing it):**
1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project**, connect the repo.
3. Leave the build command empty and the publish directory as `/` (it's a static site, nothing to build).
4. Deploy.

## Notes and honest limitations

- **No login means no moderation gate.** Anyone with the URL can post anything, including images. If this goes anywhere public, check in on it occasionally — Firestore's console lets you delete a document by hand under **Firestore Database → Data**.
- **Images are stored as compressed base64 text** inside each post (resized to ~900px, JPEG quality ~0.7) rather than in separate file storage — this keeps setup to just Firestore, no extra billing-gated storage bucket. Very large or unusual images may occasionally get rejected by the security rule's size cap; that's intentional, to keep the database healthy.
- The feed loads the most recent 200 memories. That's adjustable in `app.js` (`.limit(200)`) if you want more.
