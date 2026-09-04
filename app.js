/* Memory Lane — app logic
   Requires firebase-config.js to be loaded first (see that file for setup steps). */

(function () {
  "use strict";

  // ---- Firebase init ----
  if (typeof firebase === "undefined" || !window.MEMORY_LANE_FIREBASE_CONFIG) {
    showFatalError();
    return;
  }
  firebase.initializeApp(window.MEMORY_LANE_FIREBASE_CONFIG);
  const db = firebase.firestore();
  const memoriesRef = db.collection("memories");

  // ---- Elements ----
  const openBtn = document.getElementById("openComposer");
  const closeBtn = document.getElementById("closeComposer");
  const composer = document.getElementById("composer");
  const form = document.getElementById("memoryForm");
  const nameInput = document.getElementById("name");
  const storyInput = document.getElementById("story");
  const storyCount = document.getElementById("storyCount");
  const photoInput = document.getElementById("photo");
  const photoPreviewWrap = document.getElementById("photoPreviewWrap");
  const photoPreview = document.getElementById("photoPreview");
  const removePhotoBtn = document.getElementById("removePhoto");
  const submitBtn = document.getElementById("submitBtn");
  const formError = document.getElementById("formError");
  const feed = document.getElementById("feed");
  const statusMsg = document.getElementById("statusMsg");
  const cardTemplate = document.getElementById("cardTemplate");

  let compressedPhotoDataUrl = null;

  // ---- Composer open/close ----
  openBtn.addEventListener("click", () => {
    composer.hidden = false;
    composer.scrollIntoView({ behavior: "smooth", block: "center" });
    nameInput.focus();
  });
  closeBtn.addEventListener("click", () => { composer.hidden = true; });

  storyInput.addEventListener("input", () => {
    storyCount.textContent = storyInput.value.length;
  });

  // ---- Photo select + client-side compression ----
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      formError.textContent = "That file doesn't look like an image.";
      photoInput.value = "";
      return;
    }
    try {
      compressedPhotoDataUrl = await compressImage(file, 900, 0.72);
      photoPreview.src = compressedPhotoDataUrl;
      photoPreviewWrap.hidden = false;
      formError.textContent = "";
    } catch (err) {
      formError.textContent = "Couldn't read that photo — try a different file.";
    }
  });

  removePhotoBtn.addEventListener("click", () => {
    compressedPhotoDataUrl = null;
    photoInput.value = "";
    photoPreviewWrap.hidden = true;
  });

  function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- Submit ----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.textContent = "";

    const name = nameInput.value.trim();
    const story = storyInput.value.trim();

    if (!name) { formError.textContent = "Let us know what to call you."; nameInput.focus(); return; }
    if (!story) { formError.textContent = "The memory field is empty."; storyInput.focus(); return; }
    if (story.length > 1200) { formError.textContent = "That's a lot of memory — trim it under 1200 characters."; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = "Pinning…";

    try {
      await memoriesRef.add({
        name: name.slice(0, 40),
        story: story.slice(0, 1200),
        photo: compressedPhotoDataUrl || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      form.reset();
      storyCount.textContent = "0";
      compressedPhotoDataUrl = null;
      photoPreviewWrap.hidden = true;
      composer.hidden = true;
    } catch (err) {
      console.error(err);
      formError.textContent = "Couldn't post that just now — check your connection and try again.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Pin it to the board";
    }
  });

  // ---- Live feed ----
  memoriesRef.orderBy("timestamp", "desc").limit(200).onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        statusMsg.textContent = "No memories pinned yet — be the first to share one.";
        statusMsg.hidden = false;
        feed.innerHTML = "";
        return;
      }
      statusMsg.hidden = true;
      feed.innerHTML = "";
      snapshot.forEach((doc) => renderCard(doc.data()));
    },
    (err) => {
      console.error(err);
      statusMsg.textContent = "Couldn't load memories right now — refresh to try again.";
      statusMsg.hidden = false;
    }
  );

  function renderCard(data) {
    const node = cardTemplate.content.cloneNode(true);
    const photoWrap = node.querySelector(".card__photoWrap");
    const photoEl = node.querySelector(".card__photo");
    const storyEl = node.querySelector(".card__story");
    const nameEl = node.querySelector(".card__name");
    const dateEl = node.querySelector(".card__date");

    if (data.photo) {
      photoEl.src = data.photo;
      photoEl.alt = "A photo shared with this memory";
    } else {
      photoWrap.remove();
    }

    storyEl.textContent = data.story || "";
    nameEl.textContent = data.name || "Someone";
    dateEl.textContent = formatDate(data.timestamp);

    feed.appendChild(node);
  }

  function formatDate(ts) {
    if (!ts || !ts.toDate) return "just now";
    const d = ts.toDate();
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function showFatalError() {
    statusMsg.textContent = "This board isn't connected to a database yet — see firebase-config.js.";
    statusMsg.hidden = false;
    openBtn.disabled = true;
  }
})();
