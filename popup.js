const itemList = document.getElementById("itemList");
const saveBtn = document.getElementById("saveBtn");
const applyBtn = document.getElementById("applyBtn");
const deleteBtn = document.getElementById("deleteBtn");

const DB_NAME = "FormSaveDB";
const STORE_NAME = "savedItems";
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject("DBオープン失敗");
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

function saveItemToIndexedDB(item) {
  return openDatabase().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(item);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  });
}

function getAllItemsFromIndexedDB() {
  return openDatabase().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
  });
}

function deleteItemFromIndexedDB(id) {
  return openDatabase().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  });
}

function generateUniqueId() {
  const now = new Date();
  return now.getFullYear().toString()
    + (now.getMonth() + 1).toString().padStart(2, '0')
    + now.getDate().toString().padStart(2, '0')
    + now.getHours().toString().padStart(2, '0')
    + now.getMinutes().toString().padStart(2, '0')
    + now.getSeconds().toString().padStart(2, '0');
}

document.addEventListener("DOMContentLoaded", updateList);

saveBtn.addEventListener("click", async () => {
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab || !tab.id) return console.log("タブ取得失敗");

  const id = generateUniqueId();

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });

  setTimeout(() => {
    chrome.storage.local.get({ tempFormData: [] }, async (result) => {
      const formData = result.tempFormData;

      const newEntry = {
        id,
        title: tab.title || "(タイトル不明)",
        url: tab.url || "",
        form: formData
      };

      await saveItemToIndexedDB(newEntry);
      chrome.storage.local.remove("tempFormData");
      updateList();
      console.log("保存しました: " + newEntry.title);
    });
  }, 300);
});

applyBtn.addEventListener("click", async () => {
  const selectedId = itemList.value;
  if (!selectedId) return console.log("反映対象を選んでください");

  const items = await getAllItemsFromIndexedDB();
  const item = items.find(entry => entry.id === selectedId);

  if (!item) {
    console.log("選択されたデータが見つかりません");
    return;
  }

  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab || !tab.id) {
    console.log("タブが取得できませんでした");
    return;
  }

  // formData をスクリプトに送って実行
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: injectFormValues,
    args: [item.form]
  });

  console.log("フォームに値を反映しました！");
});

// 実行される関数本体（ページ側）
function injectFormValues(formData) {
  formData.forEach(({ name, value }) => {
    if (!name) return;

    const elements = document.querySelectorAll(`[name="${name}"]`);

    // 複数要素：radio や checkbox group
    if (elements.length > 1) {
      elements.forEach(el => {
        if (el.type === "radio") {
          el.checked = el.value === value;
        } else if (el.type === "checkbox") {
          el.checked = value === "true" || value === el.value;
        }
      });
      return;
    }

    const el = elements[0] || document.getElementById(name);
    if (!el) return;

    const tag = el.tagName.toLowerCase();

    if (tag === "input") {
      if (el.type === "checkbox") {
        el.checked = value === "true" || value === el.value;
      } else {
        el.value = value;
      }
    } else if (tag === "select") {
      if (el.multiple && Array.isArray(value)) {
        Array.from(el.options).forEach(opt => {
          opt.selected = value.includes(opt.value);
        });
      } else {
        console.log("select fail");
      }
    } else if (tag === "textarea") {
      el.textContent = value;
      // el.value = value;
    } else {
      console.log("textarea fail");
    }
  });
}





deleteBtn.addEventListener("click", async () => {
  const selectedId = itemList.value;
  if (!selectedId) return console.log("削除対象を選択してください");

  await deleteItemFromIndexedDB(selectedId);
  updateList();
  console.log("削除しました");
});

async function updateList() {
  const items = await getAllItemsFromIndexedDB();
  itemList.innerHTML = "";

  items.forEach(entry => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = `${entry.title} - ${entry.id}`;
    itemList.appendChild(option);
  });
}
