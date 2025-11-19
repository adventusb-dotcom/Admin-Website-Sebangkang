import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

// ========================================================
//  FIREBASE
// ========================================================
const firebaseConfig = {
  apiKey: "AIzaSyD6RAnjcCki0ti3CymbHFVtXudIFsFayP0",
  authDomain: "dusun-sebangkang.firebaseapp.com",
  databaseURL: "https://dusun-sebangkang-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dusun-sebangkang",
  storageBucket: "dusun-sebangkang.appspot.com",
  messagingSenderId: "740252061591",
  appId: "1:740252061591:web:73abbbf1270b9ef0867ed2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ========================================================
//  TOAST
// ========================================================
function showToast(msg, type="success"){
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add("show"),50);
  setTimeout(()=>{
    t.classList.remove("show");
    setTimeout(()=>t.remove(),300);
  },3000);
}

// ========================================================
//  PENGUMUMAN (TIDAK DIUBAH)
// ========================================================
const adminBoard = document.getElementById("adminBoard");
const notifCount = document.getElementById("notifCount");
const form = document.getElementById("announcementForm");
const editModal = document.getElementById("editModal");
const deleteModal = document.getElementById("deleteModal");
const editTitle = document.getElementById("editTitle");
const editDate = document.getElementById("editDate");
const editDesc = document.getElementById("editDesc");
const editConfirm = document.getElementById("editConfirmBtn");
const editCancel = document.getElementById("editCancelBtn");
const deleteConfirm = document.getElementById("deleteConfirmBtn");
const deleteCancel = document.getElementById("deleteCancelBtn");

let currentEditKey = null;
let currentDeleteKey = null;

// Tambah pengumuman
form.addEventListener("submit", e=>{
  e.preventDefault();
  const title = document.getElementById("title").value.trim();
  const date = document.getElementById("date").value;
  const desc = document.getElementById("desc").value.trim();

  if(!title || !date || !desc){
    showToast("Lengkapi semua kolom!","error");
    return;
  }

  const newRef = push(ref(db,"announcements"));
  set(newRef,{title,date,desc,timestamp:new Date().toISOString()})
    .then(()=>{ form.reset(); showToast("Pengumuman terkirim!"); })
    .catch(err=>showToast("Gagal: "+err.message,"error"));
});

// Render pengumuman
onValue(ref(db,"announcements"), snap=>{
  adminBoard.innerHTML="";
  let count=0;

  if(snap.exists()){
    snap.forEach(child=>{
      count++;
      const data=child.val();
      const key=child.key;
      const card=document.createElement("div");
      card.className="announcement-card";
      card.dataset.key=key;

      card.innerHTML=`
        <h3>${data.title}</h3>
        <p><b>Tanggal:</b> ${data.date}</p>
        <p>${data.desc}</p>
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Hapus</button>
      `;
      adminBoard.appendChild(card);
    });
  }
  notifCount.textContent=count;
});

// EVENT edit & delete
adminBoard.addEventListener("click", e=>{
  const card=e.target.closest(".announcement-card");
  if(!card) return;
  const key=card.dataset.key;

  if(e.target.classList.contains("edit-btn")){
    currentEditKey=key;
    editModal.classList.add("show");
  }

  if(e.target.classList.contains("delete-btn")){
    currentDeleteKey=key;
    deleteModal.classList.add("show");
  }
});

editCancel.onclick=()=>editModal.classList.remove("show");
deleteCancel.onclick=()=>deleteModal.classList.remove("show");

editConfirm.onclick=()=>{
  if(!currentEditKey) return;
  const updates={};
  if(editTitle.value.trim()) updates.title=editTitle.value.trim();
  if(editDate.value) updates.date=editDate.value;
  if(editDesc.value.trim()) updates.desc=editDesc.value.trim();

  update(ref(db,"announcements/"+currentEditKey),updates)
    .then(()=>showToast("Pengumuman diperbarui!"))
    .catch(err=>showToast("Error: "+err.message,"error"));

  editModal.classList.remove("show");
};

deleteConfirm.onclick=()=>{
  if(!currentDeleteKey) return;
  remove(ref(db,"announcements/"+currentDeleteKey))
    .then(()=>showToast("Pengumuman dihapus!"))
    .catch(err=>showToast("Error: "+err.message,"error"));
  deleteModal.classList.remove("show");
};

// ========================================================
//  KOMENTAR + REPLY BERTINGKAT
// ========================================================
const adminKomentarBoard=document.getElementById("adminKomentarBoard");

// Modal komentar utama
const deleteKomentarModal=document.getElementById("deleteKomentarModal");
const deleteKomentarConfirm2=document.getElementById("deleteKomentarConfirm");
const deleteKomentarCancel2=document.getElementById("deleteKomentarCancel");

const replyKomentarModal=document.getElementById("replyKomentarModal");
const replyPesan=document.getElementById("replyPesan");
const replyKomentarConfirm=document.getElementById("replyKomentarConfirm");
const replyKomentarCancel=document.getElementById("replyKomentarCancel");

// Modal nested reply
const replyNestedModal=document.getElementById("replyNestedModal");
const replyNestedPesan=document.getElementById("replyNestedPesan");
const replyNestedConfirm=document.getElementById("replyNestedConfirm");
const replyNestedCancel=document.getElementById("replyNestedCancel");

let currentReplyKomentarKey=null;
let currentDeleteKomentarKey=null;
let nestedKomentarKey=null;
let nestedReplyPath=null;

// ========================================================
// RENDER REPLIES — FIX rpath
// ========================================================
function renderReplies(list, komentarKey, level=1, parentPath="replies"){
  let html="";
  for(const [replyKey, r] of Object.entries(list)){
    const path=`${parentPath}/${replyKey}`;
    const isAdmin=(r.nama||"").toLowerCase()==="admin";

    html+=`
      <div class="reply-card ${isAdmin?"admin-reply":""}" style="margin-left:${level*15}px">
        <h4>${r.nama}</h4>
        <div class="reply-text">${r.pesan}</div>
        <div class="reply-time">${r.timestamp?new Date(r.timestamp).toLocaleString():""}</div>

        <div class="reply-actions">
          <button class="reply-action-btn nested-reply-btn"
            data-kid="${komentarKey}" data-rpath="${path}">Reply</button>

          <button class="reply-action-btn nested-delete-btn"
            data-kid="${komentarKey}" data-rpath="${path}">Hapus</button>
        </div>
      </div>
    `;

    if(r.replies){
      html+=renderReplies(r.replies, komentarKey, level+1, path);
    }
  }
  return html;
}

// ========================================================
// RENDER KOMENTAR UTAMA
// ========================================================
onValue(ref(db,"komentar"), snap=>{
  adminKomentarBoard.innerHTML="";

  if(!snap.exists()) return;

  snap.forEach(child=>{
    const data=child.val();
    const key=child.key;

    const replies=data.replies?renderReplies(data.replies,key):"";

    const card=document.createElement("div");
    card.className="announcement-card";
    card.dataset.key=key;

    card.innerHTML=`
      <h3>${data.nama}</h3>
      <p>${data.pesan}</p>

      <button class="reply-btn">Reply</button>
      <button class="delete-btn">Hapus</button>

      <div class="reply-container">${replies}</div>
    `;

    adminKomentarBoard.appendChild(card);
  });
});

// ========================================================
// REPLY KOMENTAR UTAMA
// ========================================================
adminKomentarBoard.addEventListener("click", e=>{
  const card=e.target.closest(".announcement-card");
  if(!card) return;
  const key=card.dataset.key;

  if(e.target.classList.contains("reply-btn")){
    currentReplyKomentarKey=key;
    replyPesan.value="";
    replyKomentarModal.classList.add("show");
  }

  if(e.target.classList.contains("delete-btn")){
    currentDeleteKomentarKey=key;
    deleteKomentarModal.classList.add("show");
  }
});

replyKomentarConfirm.onclick=()=>{
  if(!currentReplyKomentarKey||!replyPesan.value.trim()) return;

  push(ref(db,`komentar/${currentReplyKomentarKey}/replies`),{
    nama:"Admin",
    pesan:replyPesan.value.trim(),
    timestamp:new Date().toISOString()
  });

  replyKomentarModal.classList.remove("show");
};

// ========================================================
//  NESTED REPLY
// ========================================================
adminKomentarBoard.addEventListener("click", e=>{
  if(e.target.classList.contains("nested-reply-btn")){
    nestedKomentarKey=e.target.dataset.kid;
    nestedReplyPath=e.target.dataset.rpath;
    replyNestedPesan.value="";
    replyNestedModal.classList.add("show");
  }
});

replyNestedConfirm.onclick=()=>{
  if(!nestedKomentarKey||!nestedReplyPath) return;

  push(ref(db,`komentar/${nestedKomentarKey}/${nestedReplyPath}/replies`),{
    nama:"Admin",
    pesan:replyNestedPesan.value.trim(),
    timestamp:new Date().toISOString()
  });

  replyNestedModal.classList.remove("show");
};

// ========================================================
//  DELETE KOMENTAR UTAMA
// ========================================================
deleteKomentarCancel2.onclick=()=>deleteKomentarModal.classList.remove("show");

deleteKomentarConfirm2.onclick=()=>{
  if(!currentDeleteKomentarKey) return;
  remove(ref(db,`komentar/${currentDeleteKomentarKey}`));
  deleteKomentarModal.classList.remove("show");
};

// ========================================================
//  DELETE NESTED REPLY — FIX rpath
// ========================================================
adminKomentarBoard.addEventListener("click", e=>{
  if(e.target.classList.contains("nested-delete-btn")){
    const kid=e.target.dataset.kid;
    const rpath=e.target.dataset.rpath;

    remove(ref(db,`komentar/${kid}/${rpath}`))
      .then(()=>showToast("Reply dihapus!"))
      .catch(err=>showToast("Gagal hapus reply: "+err.message,"error"));
  }
});

// ========================================================
//  CLOSE MODALS
// ========================================================
[replyKomentarModal, deleteKomentarModal, replyNestedModal].forEach(m=>{
  m.addEventListener("click", e=>{
    if(e.target===m) m.classList.remove("show");
  });
});
