import React, { useState, useEffect } from 'react';
import { Book, ChevronLeft, ChevronRight, Menu, Search, Play, RotateCcw, Bookmark, List, Plus, Trash2, Lock, Save, User, LogOut, Settings, Image as ImageIcon, Moon, Sun, Home, AlertTriangle, X, SkipForward, Edit, FilePenLine, Type, AlignJustify, AlignLeft } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// --- CẤU HÌNH FIREBASE ---
const manualConfig = {
  apiKey: "AIzaSyATK-OHrtkDf5yt34xeZleEG8-cNIMQ3jc",
  authDomain: "webtruyen-92e3c.firebaseapp.com",
  projectId: "webtruyen-92e3c",
  storageBucket: "webtruyen-92e3c.firebasestorage.app",
  messagingSenderId: "390816520644",
  appId: "1:390816520644:web:4929466152ad122a172c91"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : manualConfig;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-novel-app';

let db, auth;
if (firebaseConfig && firebaseConfig.apiKey) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Lỗi khởi tạo Firebase:", error);
  }
}

export default function App() {
  // --- STATE ---
  const [user, setUser] = useState(null);
  
  // Data State
  const [novels, setNovels] = useState([]);
  const [selectedNovel, setSelectedNovel] = useState(null);
  const [chapters, setChapters] = useState([]);
  
  // View State
  const [view, setView] = useState('home');
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showChapterList, setShowChapterList] = useState(false);
  const [readingProgress, setReadingProgress] = useState({}); 

  // Reader Settings State (MỚI)
  const [showReaderSettings, setShowReaderSettings] = useState(false);
  const [readerSettings, setReaderSettings] = useState({
    fontSize: 18,
    lineHeight: 1.6,
    fontFamily: 'font-serif', // hoặc 'font-sans'
    textAlign: 'text-justify'
  });

  // Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddNovelModal, setShowAddNovelModal] = useState(false);
  const [showEditNovelModal, setShowEditNovelModal] = useState(false); 
  const [editingChapter, setEditingChapter] = useState(null);
  
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  
  const [deleteModal, setDeleteModal] = useState({ show: false, type: null, id: null, title: '' });

  // Forms
  const [newNovelTitle, setNewNovelTitle] = useState('');
  const [newNovelAuthor, setNewNovelAuthor] = useState('');
  const [newNovelCover, setNewNovelCover] = useState('');
  
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterContent, setNewChapterContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- INIT & AUTH ---
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Lỗi đăng nhập:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    
    if (localStorage.getItem('novel_admin_session') === 'NgoDucDuy') setIsAdmin(true);
    if (localStorage.getItem('novel_theme') === 'light') setIsDarkMode(false);

    const savedProgress = JSON.parse(localStorage.getItem('novel_progress') || '{}');
    setReadingProgress(savedProgress);

    // Load reader settings
    const savedReaderSettings = JSON.parse(localStorage.getItem('novel_reader_settings'));
    if (savedReaderSettings) setReaderSettings(savedReaderSettings);

    return () => unsubscribe();
  }, []);

  const saveProgress = (novelId, chapterIndex) => {
    const newProgress = { ...readingProgress, [novelId]: chapterIndex };
    setReadingProgress(newProgress);
    localStorage.setItem('novel_progress', JSON.stringify(newProgress));
  };

  // Lưu cài đặt đọc truyện
  const updateReaderSettings = (newSettings) => {
    const updated = { ...readerSettings, ...newSettings };
    setReaderSettings(updated);
    localStorage.setItem('novel_reader_settings', JSON.stringify(updated));
  };

  // --- FETCH DATA ---
  useEffect(() => {
    if (!user || !db) return;
    const qNovels = collection(db, 'artifacts', appId, 'public', 'data', 'novels');
    const unsubscribe = onSnapshot(qNovels, (snapshot) => {
      const fetchedNovels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedNovels.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNovels(fetchedNovels);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !db || !selectedNovel) {
      setChapters([]);
      return;
    }
    const qChapters = collection(db, 'artifacts', appId, 'public', 'data', 'novels', selectedNovel.id, 'chapters');
    const unsubscribe = onSnapshot(qChapters, (snapshot) => {
      const fetchedChapters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedChapters.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setChapters(fetchedChapters);
    });
    return () => unsubscribe();
  }, [selectedNovel, user]);

  // --- FILTERED NOVELS (SEARCH) ---
  const filteredNovels = novels.filter(novel => {
    if (!searchTerm) return true;
    const lowerTerm = searchTerm.toLowerCase();
    return novel.title.toLowerCase().includes(lowerTerm) || 
           novel.author.toLowerCase().includes(lowerTerm);
  });

  // --- ACTIONS: ADMIN ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (usernameInput === 'NgoDucDuy' && passwordInput === 'hthtcvnhaha') {
      setIsAdmin(true);
      setShowLoginModal(false);
      localStorage.setItem('novel_admin_session', 'NgoDucDuy');
      alert(`Xin chào Admin ${usernameInput}!`);
    } else {
      alert('Sai tài khoản hoặc mật khẩu!');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('novel_admin_session');
    setView('home');
  };

  const handleAddNovel = async (e) => {
    e.preventDefault();
    if (!newNovelTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'novels'), {
        title: newNovelTitle,
        author: newNovelAuthor || 'Vô danh',
        cover: newNovelCover || 'https://placehold.co/400x600?text=No+Cover',
        createdAt: Date.now(),
        chapterCount: 0
      });
      setNewNovelTitle(''); setNewNovelAuthor(''); setNewNovelCover('');
      setShowAddNovelModal(false);
      alert('Đã tạo truyện mới thành công!');
    } catch (error) {
      alert('Lỗi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddChapter = async (e) => {
    e.preventDefault();
    if (!newChapterTitle.trim() || !newChapterContent.trim() || !selectedNovel) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'novels', selectedNovel.id, 'chapters'), {
        title: newChapterTitle,
        content: newChapterContent,
        createdAt: Date.now()
      });
      const novelRef = doc(db, 'artifacts', appId, 'public', 'data', 'novels', selectedNovel.id);
      await updateDoc(novelRef, { chapterCount: (chapters.length + 1) });
      setNewChapterTitle(''); setNewChapterContent('');
      alert('Đã đăng chương mới!');
    } catch (error) {
      alert('Lỗi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- ACTIONS: EDIT ---
  const openEditNovelModal = () => {
    if (!selectedNovel) return;
    setNewNovelTitle(selectedNovel.title);
    setNewNovelAuthor(selectedNovel.author);
    setNewNovelCover(selectedNovel.cover);
    setShowEditNovelModal(true);
  };

  const handleUpdateNovel = async (e) => {
    e.preventDefault();
    if (!selectedNovel || !newNovelTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const novelRef = doc(db, 'artifacts', appId, 'public', 'data', 'novels', selectedNovel.id);
      await updateDoc(novelRef, {
        title: newNovelTitle,
        author: newNovelAuthor,
        cover: newNovelCover
      });
      setSelectedNovel(prev => ({...prev, title: newNovelTitle, author: newNovelAuthor, cover: newNovelCover}));
      setShowEditNovelModal(false);
      alert('Đã cập nhật thông tin truyện!');
    } catch (error) {
      alert('Lỗi cập nhật: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditChapterModal = (chapter) => {
    setEditingChapter({ id: chapter.id, title: chapter.title });
  };

  const handleUpdateChapter = async (e) => {
    e.preventDefault();
    if (!editingChapter || !editingChapter.title.trim()) return;
    setIsSubmitting(true);
    try {
      const chapRef = doc(db, 'artifacts', appId, 'public', 'data', 'novels', selectedNovel.id, 'chapters', editingChapter.id);
      await updateDoc(chapRef, {
        title: editingChapter.title
      });
      setEditingChapter(null);
      alert('Đã đổi tên chương thành công!');
    } catch (error) {
      alert('Lỗi đổi tên: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- ACTIONS: DELETE ---
  const requestDelete = (e, type, id, title) => {
    e.stopPropagation(); e.preventDefault();
    setDeleteModal({ show: true, type, id, title });
  };

  const confirmDelete = async () => {
    if (!deleteModal.show) return;
    const { type, id } = deleteModal;
    setDeleteModal({ ...deleteModal, show: false });
    try {
      if (type === 'novel') await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'novels', id));
      else if (type === 'chapter') await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'novels', selectedNovel.id, 'chapters', id));
    } catch (error) {
      alert("Lỗi xoá: " + error.message);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('novel_theme', !isDarkMode ? 'dark' : 'light');
  };

  const readChapter = (index) => {
    setCurrentChapterIndex(index);
    setView('reader');
    window.scrollTo(0,0);
    setShowChapterList(false);
    if (selectedNovel) saveProgress(selectedNovel.id, index);
  };

  const goHome = () => {
    setSelectedNovel(null);
    setChapters([]);
    setView('home');
  };

  // --- STYLES ---
  const themeClasses = isDarkMode ? "bg-[#0a0a0a] text-gray-200" : "bg-[#ffffff] text-gray-900";
  const cardClasses = isDarkMode ? "bg-[#171717] border-[#262626] shadow-xl" : "bg-white border-gray-200 shadow-sm";
  const headerClasses = isDarkMode ? "bg-[#0a0a0a]/90 border-[#262626]" : "bg-white/90 border-gray-200";
  const inputClasses = isDarkMode ? "bg-[#171717] border-[#404040] text-gray-200 focus:border-blue-500" : "bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500";
  const buttonPrimary = "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20";

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${themeClasses} selection:bg-blue-500 selection:text-white`}>
      
      {deleteModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`${cardClasses} p-6 rounded-lg w-full max-w-sm border`}>
            <div className="flex flex-col items-center text-center gap-4">
               <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600"><AlertTriangle size={24} /></div>
               <div><h3 className="text-xl font-bold mb-1">Xác nhận xoá?</h3><p className="text-sm opacity-80">Bạn có chắc chắn muốn xoá <b>"{deleteModal.title}"</b> không?</p></div>
               <div className="flex gap-3 w-full mt-2">
                  <button onClick={() => setDeleteModal({ ...deleteModal, show: false })} className="flex-1 py-2.5 rounded bg-gray-500/10 hover:bg-gray-500/20 font-medium">Huỷ bỏ</button>
                  <button onClick={confirmDelete} className="flex-1 py-2.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-900/20">Xoá ngay</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CHAPTER MODAL */}
      {editingChapter && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`${cardClasses} p-6 rounded-lg w-full max-w-md border`}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Đổi tên chương</h3><button onClick={() => setEditingChapter(null)}><X size={20} /></button></div>
            <form onSubmit={handleUpdateChapter} className="flex flex-col gap-4">
              <input type="text" value={editingChapter.title} onChange={e => setEditingChapter({...editingChapter, title: e.target.value})} className={`w-full p-2 rounded outline-none border ${inputClasses}`} />
              <button type="submit" disabled={isSubmitting} className={`py-3 rounded font-bold mt-2 ${buttonPrimary}`}>{isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}</button>
            </form>
          </div>
        </div>
      )}

      {/* SHOW READER SETTINGS POPUP */}
      {showReaderSettings && (
        <div className="fixed right-4 top-16 z-[90] animate-fade-in">
           <div className={`${cardClasses} p-4 rounded-lg shadow-2xl border w-72`}>
              <div className="flex justify-between items-center mb-3 border-b border-gray-500/20 pb-2">
                  <h3 className="font-bold flex items-center gap-2"><Type size={16}/> Cài đặt đọc</h3>
                  <button onClick={() => setShowReaderSettings(false)}><X size={16}/></button>
              </div>
              
              {/* Font Size */}
              <div className="mb-4">
                 <div className="flex justify-between text-sm mb-1 opacity-80"><span>Cỡ chữ</span><span>{readerSettings.fontSize}px</span></div>
                 <input 
                   type="range" min="14" max="32" step="1" 
                   value={readerSettings.fontSize} 
                   onChange={(e) => updateReaderSettings({ fontSize: parseInt(e.target.value) })}
                   className="w-full accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                 />
              </div>

              {/* Line Height */}
              <div className="mb-4">
                 <div className="text-sm mb-2 opacity-80">Dãn dòng</div>
                 <div className="flex gap-2 bg-gray-500/10 p-1 rounded">
                    {[1.4, 1.6, 1.8, 2.0].map(lh => (
                       <button 
                         key={lh}
                         onClick={() => updateReaderSettings({ lineHeight: lh })}
                         className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${readerSettings.lineHeight === lh ? 'bg-blue-600 text-white' : 'hover:bg-gray-500/20'}`}
                       >
                         {lh}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Font Family */}
              <div className="mb-2">
                 <div className="text-sm mb-2 opacity-80">Kiểu chữ</div>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => updateReaderSettings({ fontFamily: 'font-serif' })}
                      className={`flex-1 py-2 rounded border text-sm font-serif ${readerSettings.fontFamily === 'font-serif' ? 'border-blue-600 text-blue-600 bg-blue-500/10' : 'border-gray-500/30 hover:border-gray-500/60'}`}
                    >
                      Có chân
                    </button>
                    <button 
                      onClick={() => updateReaderSettings({ fontFamily: 'font-sans' })}
                      className={`flex-1 py-2 rounded border text-sm font-sans ${readerSettings.fontFamily === 'font-sans' ? 'border-blue-600 text-blue-600 bg-blue-500/10' : 'border-gray-500/30 hover:border-gray-500/60'}`}
                    >
                      Không chân
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showChapterList && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-end animate-fade-in" onClick={() => setShowChapterList(false)}>
           <div className={`w-full max-w-xs h-full ${isDarkMode ? 'bg-[#171717] border-l border-[#262626]' : 'bg-white border-l border-gray-200'} shadow-2xl flex flex-col`} onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-inherit flex justify-between items-center shrink-0">
                 <h3 className="font-bold flex items-center gap-2"><List size={20}/> Danh sách chương</h3>
                 <button onClick={() => setShowChapterList(false)} className="p-1 hover:bg-gray-500/10 rounded"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                 {chapters.map((chap, idx) => (
                    <button key={chap.id} onClick={() => readChapter(idx)} className={`w-full text-left p-3 rounded mb-1 text-sm font-medium transition-colors ${idx === currentChapterIndex ? 'bg-blue-600 text-white' : 'hover:bg-gray-500/10 opacity-80 hover:opacity-100'}`}>
                       {chap.title}
                    </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      <header className={`sticky top-0 z-50 h-16 flex items-center justify-between px-4 lg:px-8 border-b backdrop-blur-sm ${headerClasses}`}>
        <div onClick={() => {setView('home'); setSelectedNovel(null);}} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
          {view === 'home' ? <Book size={24} className="text-blue-500" /> : <Home size={24} className="text-blue-500" />}
          <span className="font-bold text-xl hidden sm:inline font-sans tracking-wide">Web Truyện</span>
        </div>
        
        {/* SEARCH BAR (NEW) */}
        {view === 'home' && (
          <div className="flex-1 max-w-md mx-4 hidden md:block relative">
             <input 
                type="text" 
                placeholder="Tìm truyện, tác giả..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-full outline-none border focus:border-blue-500 transition-all ${inputClasses}`}
             />
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
        )}

        <div className="flex items-center gap-3 text-sm font-medium">
          <button onClick={toggleTheme} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-[#262626] text-yellow-400' : 'hover:bg-gray-100 text-gray-600'}`}>
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <span className="text-blue-500 font-bold hidden sm:inline">Admin</span>
              <button onClick={handleLogout} className="p-2 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors" title="Đăng xuất"><LogOut size={20} /></button>
            </div>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className={`flex items-center gap-1 px-4 py-2 rounded transition-colors ${isDarkMode ? 'bg-[#262626] hover:bg-[#404040]' : 'bg-gray-100 hover:bg-gray-200'}`}>
              <User size={18} /> <span className="hidden sm:inline">Đăng nhập</span>
            </button>
          )}
        </div>
      </header>

      {showLoginModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`${cardClasses} p-6 rounded-lg w-full max-w-sm border`}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Đăng nhập Admin</h3><button onClick={() => setShowLoginModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input type="text" placeholder="Tài khoản" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} className={`p-3 rounded outline-none border ${inputClasses}`} />
              <input type="password" placeholder="Mật khẩu" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className={`p-3 rounded outline-none border ${inputClasses}`} />
              <button type="submit" className={`py-3 rounded font-bold mt-2 ${buttonPrimary}`}>Đăng nhập</button>
            </form>
          </div>
        </div>
      )}

      {showAddNovelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`${cardClasses} p-6 rounded-lg w-full max-w-md border`}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2"><Book size={20}/> Thêm Truyện Mới</h3><button onClick={() => setShowAddNovelModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleAddNovel} className="flex flex-col gap-4">
              <div><label className="text-xs font-bold uppercase opacity-70 mb-1 block">Tên truyện</label><input type="text" value={newNovelTitle} onChange={e => setNewNovelTitle(e.target.value)} className={`w-full p-2 rounded outline-none border ${inputClasses}`} placeholder="Ví dụ: Nhân Tổ Truyện" /></div>
              <div><label className="text-xs font-bold uppercase opacity-70 mb-1 block">Tác giả</label><input type="text" value={newNovelAuthor} onChange={e => setNewNovelAuthor(e.target.value)} className={`w-full p-2 rounded outline-none border ${inputClasses}`} placeholder="Ví dụ: Cổ Chân Nhân" /></div>
              <div><label className="text-xs font-bold uppercase opacity-70 mb-1 block">Link Ảnh Bìa</label><input type="text" value={newNovelCover} onChange={e => setNewNovelCover(e.target.value)} className={`w-full p-2 rounded outline-none border ${inputClasses}`} placeholder="https://..." /></div>
              <button type="submit" disabled={isSubmitting} className={`py-3 rounded font-bold mt-2 ${buttonPrimary}`}>{isSubmitting ? 'Đang tạo...' : 'Tạo Truyện'}</button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT NOVEL MODAL */}
      {showEditNovelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className={`${cardClasses} p-6 rounded-lg w-full max-w-md border`}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2"><Settings size={20}/> Sửa Thông Tin Truyện</h3><button onClick={() => setShowEditNovelModal(false)}><X size={20} /></button></div>
            <form onSubmit={handleUpdateNovel} className="flex flex-col gap-4">
              <div><label className="text-xs font-bold uppercase opacity-70 mb-1 block">Tên truyện</label><input type="text" value={newNovelTitle} onChange={e => setNewNovelTitle(e.target.value)} className={`w-full p-2 rounded outline-none border ${inputClasses}`} /></div>
              <div><label className="text-xs font-bold uppercase opacity-70 mb-1 block">Tác giả</label><input type="text" value={newNovelAuthor} onChange={e => setNewNovelAuthor(e.target.value)} className={`w-full p-2 rounded outline-none border ${inputClasses}`} /></div>
              <div><label className="text-xs font-bold uppercase opacity-70 mb-1 block">Link Ảnh Bìa</label><input type="text" value={newNovelCover} onChange={e => setNewNovelCover(e.target.value)} className={`w-full p-2 rounded outline-none border ${inputClasses}`} /></div>
              <button type="submit" disabled={isSubmitting} className={`py-3 rounded font-bold mt-2 ${buttonPrimary}`}>{isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}</button>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 lg:py-8 min-h-[calc(100vh-64px)]">
        {view === 'home' && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
               <h1 className="text-3xl md:text-4xl font-bold mb-3 font-serif">Kho Tàng Truyện Chữ</h1>
               <p className="opacity-70 max-w-xl mx-auto">Đọc truyện online, cập nhật liên tục.</p>
               
               {/* MOBILE SEARCH */}
               <div className="mt-4 md:hidden relative max-w-xs mx-auto">
                  <input 
                    type="text" 
                    placeholder="Tìm truyện..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 rounded-full outline-none border focus:border-blue-500 ${inputClasses}`}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
               </div>
            </div>
            {isAdmin && (
              <div className="flex justify-end gap-3 mb-6">
                <button onClick={() => {setNewNovelTitle(''); setNewNovelAuthor(''); setNewNovelCover(''); setShowAddNovelModal(true)}} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-transform active:scale-95 ${buttonPrimary}`}><Plus size={20} /> Thêm Truyện Mới</button>
              </div>
            )}
            
            {/* NOVEL GRID with SEARCH FILTER */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredNovels.length === 0 ? (
                <div className="col-span-full text-center py-20 opacity-50">
                   {searchTerm ? <p>Không tìm thấy truyện nào khớp với "{searchTerm}"</p> : <><Book size={48} className="mx-auto mb-4" /><p>Chưa có truyện nào.</p></>}
                </div>
              ) : (
                filteredNovels.map((novel) => (
                  <div key={novel.id} onClick={() => {setSelectedNovel(novel); setView('detail'); window.scrollTo(0,0);}} className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl border ${cardClasses}`}>
                    <div className="aspect-[2/3] overflow-hidden relative">
                       <img src={novel.cover} alt={novel.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onError={(e) => e.target.src='https://placehold.co/400x600?text=No+Cover'} />
                       <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
                       {isAdmin && <button onClick={(e) => requestDelete(e, 'novel', novel.id, novel.title)} className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 z-20 shadow-lg" title="Xóa"><Trash2 size={18} /></button>}
                    </div>
                    <div className="p-4">
                       <h3 className="font-bold text-lg leading-tight mb-1 truncate group-hover:text-blue-500 transition-colors font-serif">{novel.title}</h3>
                       <p className="text-xs opacity-70 flex items-center gap-1 mb-2"><User size={12} /> {novel.author}</p>
                       <div className="flex items-center gap-1 text-xs opacity-60 bg-black/10 dark:bg-white/10 w-fit px-2 py-1 rounded"><List size={12} /> {novel.chapterCount || 0} chương</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'detail' && selectedNovel && (
          <div className="animate-fade-in">
             <div className="mb-6"><button onClick={() => {setView('home'); setSelectedNovel(null);}} className="flex items-center gap-1 text-sm opacity-60 hover:opacity-100 hover:text-blue-500"><ChevronLeft size={16} /> Quay lại danh sách</button></div>
             <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-4 lg:col-span-3">
                   <div className={`${cardClasses} rounded-xl p-4 sticky top-24 border`}>
                      <div className="aspect-[2/3] rounded-lg overflow-hidden mb-4 shadow-lg relative group">
                         <img src={selectedNovel.cover} className="w-full h-full object-cover" onError={(e) => e.target.src='https://placehold.co/400x600?text=No+Cover'} />
                         {isAdmin && (
                           <button 
                              onClick={openEditNovelModal} 
                              className="absolute bottom-2 right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Sửa ảnh bìa"
                           >
                              <Edit size={18} />
                           </button>
                         )}
                      </div>
                      <h1 className="text-2xl font-bold font-serif mb-2 text-center">{selectedNovel.title}</h1>
                      <p className="text-center opacity-70 text-sm mb-6 flex items-center justify-center gap-2">
                        {selectedNovel.author}
                        {isAdmin && <button onClick={openEditNovelModal} className="text-blue-500 hover:text-blue-400" title="Sửa thông tin"><Edit size={14} /></button>}
                      </p>
                      
                      <button onClick={() => chapters.length > 0 && readChapter(0)} disabled={chapters.length === 0} className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mb-3 ${buttonPrimary}`}><Play size={18} fill="currentColor" /> Đọc Từ Đầu</button>
                      {readingProgress[selectedNovel.id] !== undefined && chapters[readingProgress[selectedNovel.id]] && (
                        <button onClick={() => readChapter(readingProgress[selectedNovel.id])} className="w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 bg-gray-500/10 hover:bg-gray-500/20 text-inherit mb-3 border border-inherit"><SkipForward size={18} /> Đọc Tiếp (Chương {readingProgress[selectedNovel.id] + 1})</button>
                      )}
                   </div>
                </div>
                <div className="md:col-span-8 lg:col-span-9">
                   {isAdmin && (
                      <div className={`${cardClasses} p-6 rounded-xl mb-8 border border-dashed border-blue-500/50`}>
                         <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-500"><Plus size={20}/> Đăng Chương Mới</h3>
                         <form onSubmit={handleAddChapter} className="flex flex-col gap-3">
                            <input type="text" placeholder="Tiêu đề chương" value={newChapterTitle} onChange={e => setNewChapterTitle(e.target.value)} className={`w-full p-2 rounded outline-none border ${inputClasses}`} />
                            <textarea rows={5} placeholder="Nội dung chương..." value={newChapterContent} onChange={e => setNewChapterContent(e.target.value)} className={`w-full p-2 rounded outline-none border font-serif ${inputClasses}`}></textarea>
                            <div className="flex justify-end"><button type="submit" disabled={isSubmitting} className={`px-6 py-2 rounded font-bold ${buttonPrimary}`}>{isSubmitting ? 'Đang đăng...' : 'Đăng Chương'}</button></div>
                         </form>
                      </div>
                   )}
                   <div className={`${cardClasses} rounded-xl overflow-hidden border`}>
                      <div className="p-4 border-b border-inherit bg-black/5 dark:bg-white/5 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><List size={18}/> Danh sách chương ({chapters.length})</h3></div>
                      <div className="max-h-[600px] overflow-y-auto p-2">
                         {chapters.length === 0 ? (<p className="text-center py-8 opacity-50">Chưa có chương nào.</p>) : (
                            <div className="grid grid-cols-1 gap-1">
                               {chapters.map((chap, idx) => {
                                  const isBookmarked = readingProgress[selectedNovel.id] === idx;
                                  return (
                                    <div key={chap.id} className="group flex justify-between items-center p-3 rounded hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors">
                                       <div onClick={() => readChapter(idx)} className="flex-1 flex items-center gap-3">
                                          <button onClick={(e) => { e.stopPropagation(); saveProgress(selectedNovel.id, idx); }} className={`p-1 rounded hover:bg-blue-500/10 ${isBookmarked ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-400'}`} title={isBookmarked ? "Đang đọc" : "Đánh dấu"}><Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} /></button>
                                          <span className={`font-medium transition-colors ${isBookmarked ? 'text-blue-500 font-bold' : 'group-hover:text-blue-500'}`}>{chap.title}</span>
                                       </div>
                                       {isAdmin && (
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={(e) => { e.stopPropagation(); openEditChapterModal(chap); }} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded" title="Sửa tên chương"><Edit size={18} /></button>
                                              <button onClick={(e) => requestDelete(e, 'chapter', chap.id, chap.title)} className="p-2 text-red-500 hover:bg-red-500/10 rounded" title="Xoá"><Trash2 size={18} /></button>
                                          </div>
                                       )}
                                    </div>
                                  );
                               })}
                            </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {view === 'reader' && selectedNovel && chapters[currentChapterIndex] && (
          <div className="max-w-3xl mx-auto animate-fade-in pb-20">
             <div className="sticky top-0 z-30 flex justify-between items-center mb-8 border-b border-inherit bg-inherit py-3 opacity-95">
                <button onClick={() => setView('detail')} className="flex items-center gap-1 hover:text-blue-500 opacity-70 hover:opacity-100 transition-all"><ChevronLeft size={20} /> Mục lục</button>
                <div className="flex items-center gap-2">
                   {/* Nút mở cài đặt đọc */}
                   <button onClick={() => setShowReaderSettings(!showReaderSettings)} className="p-2 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Cài đặt hiển thị"><Settings size={20} /></button>
                   <button onClick={() => setShowChapterList(true)} className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"><List size={20} /> <span className="hidden sm:inline font-medium">Danh sách</span></button>
                </div>
             </div>
             <article>
                <h2 className="text-3xl font-bold mb-8 text-center font-serif leading-tight text-blue-500">{chapters[currentChapterIndex].title}</h2>
                <div 
                   className={`max-w-none whitespace-pre-wrap text-justify ${readerSettings.fontFamily} ${readerSettings.textAlign}`}
                   style={{ 
                      fontSize: `${readerSettings.fontSize}px`, 
                      lineHeight: readerSettings.lineHeight 
                   }}
                >
                   {chapters[currentChapterIndex].content}
                </div>
             </article>
             <div className="flex justify-between items-center mt-16 pt-8 border-t border-inherit">
                <button onClick={() => readChapter(Math.max(0, currentChapterIndex - 1))} disabled={currentChapterIndex === 0} className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors ${currentChapterIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'bg-black/10 dark:bg-white/10 hover:bg-blue-600 hover:text-white'}`}><ChevronLeft size={18} /> Chương trước</button>
                <button onClick={() => readChapter(Math.min(chapters.length - 1, currentChapterIndex + 1))} disabled={currentChapterIndex === chapters.length - 1} className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors ${currentChapterIndex === chapters.length - 1 ? 'opacity-30 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>Chương sau <ChevronRight size={18} /></button>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
