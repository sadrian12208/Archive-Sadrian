// Archive.Sadrian - Main Application Logic v2.0 (Firebase Enabled)

const firebaseConfig = {
    apiKey: "AIzaSyCpzgXTwqnFJTZw_HkohCSB7Ylw8QSYLDM",
    authDomain: "archive-sadrian.firebaseapp.com",
    projectId: "archive-sadrian",
    storageBucket: "archive-sadrian.firebasestorage.app",
    messagingSenderId: "62491248503",
    appId: "1:62491248503:web:082f7ba134a83ac7c70372",
    measurementId: "G-8WRSC0M5QY"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ============ ADMIN MODE CHECK ============
let isAdmin = false;
let isAuthResolved = false;
let isInitResolved = false;

function checkAndHideLoader() {
    if (isAuthResolved && isInitResolved) {
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.opacity = '0';
        setTimeout(() => { if (loader) loader.style.display = 'none'; }, 300);
        const appDiv = document.querySelector('.app');
        if (appDiv) appDiv.style.opacity = '1';
    }
}

auth.onAuthStateChanged(user => {
    if (user) {
        isAdmin = true;
        document.body.classList.remove('public-mode');
        if (document.getElementById('admin-login-btn')) {
            document.getElementById('admin-login-btn').style.display = 'none';
            document.getElementById('admin-logout-btn').style.display = 'inline-block';
        }
        // Check notifications right after admin logs in
        setTimeout(checkNotifications, 1500);
    } else {
        isAdmin = false;
        document.body.classList.add('public-mode');
        if (document.getElementById('admin-login-btn')) {
            document.getElementById('admin-login-btn').style.display = 'inline-block';
            document.getElementById('admin-logout-btn').style.display = 'none';
        }
        // Clear bell when logged out
        const badge = document.getElementById('notif-badge');
        const bellBtn = document.getElementById('notif-bell-btn');
        const dropdown = document.getElementById('notif-dropdown');
        if (badge) badge.style.display = 'none';
        if (bellBtn) bellBtn.classList.remove('has-notif');
        if (dropdown) dropdown.classList.remove('open');
    }

    // Re-render UI if initialized
    if (windowProfile) {
        applyProfileToUI();
        renderFeed();
    }

    isAuthResolved = true;
    checkAndHideLoader();
});

// We need to wait for DOM elements to exist before adding listeners.
// So we wrap the login listeners in DOMContentLoaded.
document.addEventListener('DOMContentLoaded', () => {
    const loginModal = document.getElementById('login-modal');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const loginCloseBtn = document.getElementById('login-modal-close');
    const loginCancelBtn = document.getElementById('login-cancel-btn');
    const loginSubmitBtn = document.getElementById('login-submit-btn');

    function closeLoginModal() {
        if (loginModal) {
            loginModal.classList.remove('active');
            loginEmailInput.value = '';
            loginPasswordInput.value = '';
        }
    }

    document.getElementById('admin-login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        if (loginModal) {
            loginModal.classList.add('active');
            setTimeout(() => { if (loginEmailInput) loginEmailInput.focus(); }, 100);
        }
    });

    if (loginCloseBtn) loginCloseBtn.addEventListener('click', closeLoginModal);
    if (loginCancelBtn) loginCancelBtn.addEventListener('click', closeLoginModal);
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) closeLoginModal();
        });
    }

    if (loginSubmitBtn) {
        loginSubmitBtn.addEventListener('click', async () => {
            const email = loginEmailInput.value.trim();
            const password = loginPasswordInput.value.trim();

            if (!email || !password) {
                alert("Please enter both email and password.");
                return;
            }

            // Show a simple loading state
            const originalText = loginSubmitBtn.innerHTML;
            loginSubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            loginSubmitBtn.disabled = true;

            try {
                await auth.signInWithEmailAndPassword(email, password);
                alert("Logged in as Admin successfully!");
                closeLoginModal();
            } catch (error) {
                alert("Login failed: " + error.message);
            } finally {
                loginSubmitBtn.innerHTML = originalText;
                loginSubmitBtn.disabled = false;
            }
        });
    }

    document.getElementById('admin-logout-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        await auth.signOut();
        alert("Logged out.");
    });
});

// ============ DATABASE ============
let currentFilter = 'all';
let currentSort = 'newest';
let tempMedia = [];

// Default profile
const defaultProfile = {
    name: 'Sadrian',
    title: 'Archivist & Creator',
    bio: 'Documenting ideas, events, achievements and daily tasks.',
    avatar: 'https://i.pravatar.cc/150?img=11',
    banner: null,
    skills: 'Design, Web Development, Productivity',
    education: 'Self-Taught & Lifelong Learner',
    interests: 'Technology, Art, Reading',
    contactLinks: []
};

let windowProfile = null;

function getProfile() {
    return windowProfile || { ...defaultProfile };
}

async function getProfileFromDB() {
    try {
        const doc = await db.collection('settings').doc('profile').get();
        if (doc.exists) {
            return { ...defaultProfile, ...doc.data() };
        }
    } catch (e) {
        console.error("Error loading profile:", e);
    }
    return { ...defaultProfile };
}

async function saveProfile(profile) {
    windowProfile = profile;
    if (!isAdmin) return;
    try {
        await db.collection('settings').doc('profile').set(profile);
    } catch (e) {
        console.error("Error saving profile:", e);
        alert('Failed to save profile: ' + e.message + '\n\nMake sure your Firestore rules allow writes.');
    }
}

// Open IndexedDB is no longer needed
async function openDB() {
    return true; // Resolves for initialization
}

// CRUD Operations
async function addPost(post) {
    if (!isAdmin) return;
    const docRef = await db.collection('posts').add(post);
    return docRef.id;
}

async function getAllPosts() {
    try {
        const snapshot = await db.collection('posts').get();
        const posts = [];
        snapshot.forEach(doc => {
            posts.push({ id: doc.id, ...doc.data() });
        });
        return posts;
    } catch (e) {
        console.error("Error getting posts:", e);
        return [];
    }
}

async function deletePost(id) {
    if (!isAdmin) return;
    try {
        await db.collection('posts').doc(String(id)).delete();
    } catch (e) {
        console.error("Error deleting post:", e);
    }
}

async function updatePost(post) {
    try {
        const postId = String(post.id);
        const postData = { ...post };
        delete postData.id;
        await db.collection('posts').doc(postId).update(postData);
    } catch (e) {
        console.error("Error updating post:", e);
    }
}

// Separate function for public comment/reply updates (no admin required)
async function updatePostComments(postId, comments) {
    try {
        await db.collection('posts').doc(String(postId)).update({ comments: comments });
    } catch (e) {
        console.error("Error updating comments:", e);
        throw e; // re-throw so caller can handle
    }
}

// ============ DOM ELEMENTS ============
const postText = document.getElementById('post-text');
const postBtn = document.getElementById('post-btn');
const postImage = document.getElementById('post-image');
const postVideo = document.getElementById('post-video');
const mediaPreview = document.getElementById('media-preview');
const feedContainer = document.getElementById('feed-container');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const feedCount = document.getElementById('feed-count');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const modalClose = document.getElementById('modal-close');

// Profile elements
const headerAvatarImg = document.getElementById('header-avatar-img');
const profileAvatarImg = document.getElementById('profile-avatar-img');
const profileBanner = document.getElementById('profile-banner');
const profileName = document.getElementById('profile-name');
const profileTitle = document.getElementById('profile-title');
const profileBio = document.getElementById('profile-bio');
const createPostAvatar = document.getElementById('create-post-avatar');
const editProfileBtn = document.getElementById('edit-profile-btn');
const headerProfileBtn = document.getElementById('header-profile-btn');

// Profile modal elements
const profileModal = document.getElementById('profile-modal');
const profileModalClose = document.getElementById('profile-modal-close');

// Profile form inputs
const pmNameInput = document.getElementById('pm-name');
const pmTitleInput = document.getElementById('pm-title-input');
const pmBioInput = document.getElementById('pm-bio');
const pmBioCharCount = document.getElementById('pm-bio-char-count');
const pmAvatarInput = document.getElementById('pm-avatar-input');
const pmBannerInput = document.getElementById('pm-banner-input');
const pmAvatarPreview = document.getElementById('pm-avatar-preview');
const pmBannerPreview = document.getElementById('pm-banner-preview');

const pmSkillsInput = document.getElementById('pm-skills');
const pmEducationInput = document.getElementById('pm-education');
const pmInterestsInput = document.getElementById('pm-interests');
const pmContactList = document.getElementById('pm-contact-list');
const pmAddLinkBtn = document.getElementById('pm-add-link-btn');
const pdAddContactBtn = document.getElementById('pd-add-contact-btn');

const pmCancelBtn = document.getElementById('pm-cancel-btn');
const pmSaveBtn = document.getElementById('pm-save-btn');

// Profile Detailed View Elements
const profileViewSection = document.getElementById('profile-view-section');
const feedViewSection = document.getElementById('feed-view-section');
const pdBanner = document.getElementById('pd-banner');
const pdAvatar = document.getElementById('pd-avatar');
const pdName = document.getElementById('pd-name');
const pdTitle = document.getElementById('pd-title');
const pdBio = document.getElementById('pd-bio');
const pdSkills = document.getElementById('pd-skills');
const pdEducation = document.getElementById('pd-education');
const pdInterests = document.getElementById('pd-interests');
const pdContactLinks = document.getElementById('pd-contact-links');
const profileCard = document.querySelector('.profile-card');

// Category tabs (header) & post type buttons
const categoryTabs = document.querySelectorAll('.category-tab');
const typeBtns = document.querySelectorAll('.type-btn');

// Temp profile media for the modal
let tempProfileAvatar = null;
let tempProfileBanner = null;

// ============ CATEGORY TAB SELECTION ============

categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        categoryTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.category;

        // Auto-select the corresponding post-type in the composer
        if (currentFilter !== 'all') {
            const correspondingBtn = document.querySelector(`.type-btn[data-type="${currentFilter}"]`);
            if (correspondingBtn) {
                typeBtns.forEach(b => b.classList.remove('active'));
                correspondingBtn.classList.add('active');
                correspondingBtn.querySelector('input').checked = true;
            }
        }

        // Always switch back to feed view when clicking a category tab
        profileViewSection.style.display = 'none';
        feedViewSection.style.display = 'block';

        renderFeed();
    });
});

// Post type selection (radio buttons styled as buttons)
typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        btn.querySelector('input').checked = true;
    });
});

// Sort select
sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderFeed();
});

// Search
searchInput.addEventListener('input', () => {
    renderFeed();
});

// ============ MEDIA HANDLING ============

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function resizeImage(dataURL, maxWidth = 1200) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            if (w > maxWidth) {
                h = h * (maxWidth / w);
                w = maxWidth;
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataURL;
    });
}

postImage.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
        const dataURL = await readFileAsDataURL(file);
        const resized = await resizeImage(dataURL);
        tempMedia.push({ type: 'image', data: resized });
    }
    renderMediaPreview();
    postImage.value = '';
});

postVideo.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
        if (file.size > 50 * 1024 * 1024) {
            alert('Video file is very large (>50MB). It may slow down the app. Consider using a smaller video or compressing it.');
        }
        const dataURL = await readFileAsDataURL(file);
        tempMedia.push({ type: 'video', data: dataURL });
    }
    renderMediaPreview();
    postVideo.value = '';
});

// Image pasting from clipboard in textarea
postText.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let hasImage = false;
    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            const file = item.getAsFile();
            const dataURL = await readFileAsDataURL(file);
            const resized = await resizeImage(dataURL);
            tempMedia.push({ type: 'image', data: resized });
            hasImage = true;
        }
    }
    if (hasImage) {
        renderMediaPreview();
    }
});

function renderMediaPreview() {
    mediaPreview.innerHTML = '';

    tempMedia.forEach((media, index) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        if (media.type === 'image') {
            div.innerHTML = `
                <img src="${media.data}" alt="Preview">
                <button class="preview-remove" onclick="removeMediaItem(${index})">✕</button>
            `;
        } else if (media.type === 'video') {
            div.innerHTML = `
                <video src="${media.data}" controls></video>
                <button class="preview-remove" onclick="removeMediaItem(${index})">✕</button>
            `;
        }
        mediaPreview.appendChild(div);
    });
}

function removeMedia() {
    tempMedia = [];
    renderMediaPreview();
}

function removeMediaItem(index) {
    tempMedia.splice(index, 1);
    renderMediaPreview();
}

// ============ POST CREATION ============

postBtn.addEventListener('click', async () => {
    const text = postText.value.trim();
    const selectedType = document.querySelector('input[name="post-type"]:checked').value;
    const profile = getProfile();

    if (!text && tempMedia.length === 0) {
        alert('Please write something or attach a media file.');
        return;
    }

    const post = {
        text: text,
        category: selectedType,
        media: tempMedia,
        image: tempMedia.length > 0 && tempMedia[0].type === 'image' ? tempMedia[0].data : null,
        video: tempMedia.length > 0 && tempMedia[0].type === 'video' ? tempMedia[0].data : null,
        timestamp: Date.now(),
        likes: 0,
        liked: false,
        comments: [],
        author: profile.name,
        avatar: profile.avatar
    };

    // Notion-style todo tasks initialization
    if (selectedType === 'tasks') {
        post.todoList = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                let cleanLine = line.replace(/^-\s*\[\s*\]\s*/, '').replace(/^-\s*/, '');
                return {
                    text: cleanLine,
                    completed: false,
                    completedDate: null
                };
            });
    }

    try {
        await addPost(post);
        postText.value = '';
        removeMedia();
        await renderFeed();
    } catch (err) {
        console.error('Error posting:', err);
        alert('Failed to save post: ' + err.message + '\n\nMake sure you have created the Firestore Database in Test Mode.');
    }
});

// ============ FEED RENDERING ============

async function renderFeed() {
    try {
        let posts = await getAllPosts();
        const searchQuery = searchInput.value.toLowerCase().trim();

        // Filter by category
        if (currentFilter !== 'all') {
            posts = posts.filter(p => p.category === currentFilter);
        }

        // Filter by search
        if (searchQuery) {
            posts = posts.filter(p =>
                p.text.toLowerCase().includes(searchQuery) ||
                p.category.toLowerCase().includes(searchQuery)
            );
        }

        // Sort
        posts.sort((a, b) => {
            if (currentSort === 'newest') return b.timestamp - a.timestamp;
            return a.timestamp - b.timestamp;
        });

        // Update count
        feedCount.textContent = posts.length + ' archive' + (posts.length !== 1 ? 's' : '');

        // Update category counts
        await updateCategoryCounts();

        // Render
        if (posts.length === 0) {
            feedContainer.innerHTML = '';
            feedContainer.appendChild(emptyState);
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        feedContainer.innerHTML = '';

        posts.forEach(post => {
            const card = createPostCard(post);
            feedContainer.appendChild(card);
        });
    } catch (err) {
        console.error('Error rendering feed:', err);
    }
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'archive-card';
    card.dataset.postId = post.id;
    const profile = getProfile();

    const date = new Date(post.timestamp);
    const timeStr = formatDate(date);
    const badgeClass = 'badge-' + post.category;
    const iconMap = {
        ideas: 'fa-lightbulb',
        events: 'fa-calendar-day',
        achievements: 'fa-trophy',
        tasks: 'fa-check-circle',
        notes: 'fa-sticky-note'
    };
    const catName = post.category.charAt(0).toUpperCase() + post.category.slice(1);

    // Use current profile avatar for the user's own posts
    const displayAvatar = post.avatar || profile.avatar;
    const displayName = post.author || profile.name;

    // Handle Media - Multiple Media Carousel or Single Media
    let mediaHTML = '';
    let postMedia = [];
    if (post.media && Array.isArray(post.media)) {
        postMedia = post.media;
    } else {
        if (post.image) postMedia.push({ type: 'image', data: post.image });
        if (post.video) postMedia.push({ type: 'video', data: post.video });
    }

    if (postMedia.length === 1) {
        const item = postMedia[0];
        if (item.type === 'image') {
            mediaHTML = `
                <div class="archive-media">
                    <img src="${item.data}" alt="Archive image" onclick="openImageModal(this.src)">
                </div>
            `;
        } else if (item.type === 'video') {
            mediaHTML = `
                <div class="archive-media">
                    <video src="${item.data}" controls poster=""></video>
                </div>
            `;
        }
    } else if (postMedia.length > 1) {
        // Render Instagram-style Carousel
        let slidesHTML = '';
        let indicatorsHTML = '';
        postMedia.forEach((item, index) => {
            const activeClass = index === 0 ? 'active' : '';
            indicatorsHTML += `<div class="indicator-dot ${activeClass}" data-slide-to="${index}"></div>`;
            if (item.type === 'image') {
                slidesHTML += `
                    <div class="carousel-slide">
                        <img src="${item.data}" alt="Archive image ${index+1}" onclick="openImageModal(this.src)">
                    </div>
                `;
            } else if (item.type === 'video') {
                slidesHTML += `
                    <div class="carousel-slide">
                        <video src="${item.data}" controls></video>
                    </div>
                `;
            }
        });

        mediaHTML = `
            <div class="carousel-container" data-active-index="0">
                <div class="carousel-slides">
                    ${slidesHTML}
                </div>
                <button class="carousel-btn carousel-prev" style="opacity: 0;">❮</button>
                <button class="carousel-btn carousel-next">❯</button>
                <div class="carousel-indicators">
                    ${indicatorsHTML}
                </div>
            </div>
        `;
    }

    let currentUserEmail = '';
    if (auth.currentUser && auth.currentUser.email) {
        currentUserEmail = auth.currentUser.email.toLowerCase();
    } else {
        currentUserEmail = (localStorage.getItem('visitorEmail') || '').toLowerCase();
    }

    const renderReplies = (replies, parentId) => {
        if (!replies || replies.length === 0) return '';
        return `
            <div class="replies-container">
                ${replies.map(r => `
                    <div class="reply-item">
                        <div class="comment-item-header">
                            <span class="comment-author-email">${escapeHtml(r.authorEmail || r.author)}</span>
                            <span class="comment-timestamp">${formatDate(new Date(r.timestamp))}</span>
                        </div>
                        <div class="comment-item-text">${escapeHtml(r.text)}</div>
                        <div class="comment-actions">
                            <button class="comment-action-btn" onclick="showReplyForm('${post.id}', '${parentId}')">Reply</button>
                            ${isAdmin ? `<button class="comment-action-btn delete-btn" onclick="deleteComment('${post.id}', '${r.id || r.timestamp}', '${parentId}')"><i class="fas fa-trash-alt"></i></button>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    let commentsHtml = `
        <div class="comments-section" id="comments-section-${post.id}" style="display: none;">
            <div class="comments-header"><i class="far fa-comments"></i> Comments (${post.comments ? post.comments.length : 0})</div>
            <div class="comments-list-container">
                ${(post.comments && post.comments.length > 0) ?
            post.comments.map(c => `
                        <div class="comment-item" data-comment-id="${c.id || c.timestamp}">
                            <div class="comment-item-header">
                                <span class="comment-author-email">${escapeHtml(c.authorEmail || c.author)}</span>
                                <span class="comment-timestamp">${formatDate(new Date(c.timestamp))}</span>
                            </div>
                            <div class="comment-item-text">${escapeHtml(c.text)}</div>
                            <div class="comment-actions">
                                <button class="comment-action-btn" onclick="showReplyForm('${post.id}', '${c.id || c.timestamp}')">Reply</button>
                                ${isAdmin ? `<button class="comment-action-btn delete-btn" onclick="deleteComment('${post.id}', '${c.id || c.timestamp}')"><i class="fas fa-trash-alt"></i></button>` : ''}
                            </div>
                            
                            <div class="reply-form" id="reply-form-${post.id}-${c.id || c.timestamp}">
                                ${isAdmin ? '' : `<input type="email" id="reply-email-${post.id}-${c.id || c.timestamp}" class="comment-email-input" placeholder="Your email (e.g. name@example.com)" value="${escapeHtml(currentUserEmail)}">`}
                                <div class="comment-input-row">
                                    <textarea id="reply-text-${post.id}-${c.id || c.timestamp}" class="comment-textarea" placeholder="Write a reply..." rows="1"></textarea>
                                    <button class="comment-submit-btn" onclick="submitReply('${post.id}', '${c.id || c.timestamp}')" title="Post reply">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                </div>
                            </div>
                            
                            ${renderReplies(c.replies, c.id || c.timestamp)}
                        </div>
                    `).join('') : '<div class="no-comments-yet">No comments yet. Be the first to comment!</div>'
        }
            </div>
            <div class="comment-form">
                ${isAdmin ? '' : `<input type="email" id="comment-email-${post.id}" class="comment-email-input" placeholder="Your email (e.g. name@example.com)" value="${escapeHtml(currentUserEmail)}">`}
                <div class="comment-input-row">
                    <textarea id="comment-text-${post.id}" class="comment-textarea" placeholder="Write a comment..." rows="1"></textarea>
                    <button class="comment-submit-btn" onclick="submitComment('${post.id}')" title="Post comment">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Render Notion Checklist if category is tasks
    let contentAreaHTML = '';
    if (post.category === 'tasks' && post.todoList && post.todoList.length > 0) {
        let itemsHTML = '';
        post.todoList.forEach((item, index) => {
            const checkedAttr = item.completed ? 'checked' : '';
            const completedClass = item.completed ? 'completed' : '';
            let dateHTML = '';
            if (item.completed && item.completedDate) {
                const compDate = new Date(item.completedDate);
                const dateStr = compDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                dateHTML = `<span class="todo-completed-date"><i class="fas fa-check"></i> ${dateStr}</span>`;
            }
            itemsHTML += `
                <label class="notion-todo-item ${completedClass}">
                    <input type="checkbox" class="notion-todo-checkbox" data-post-id="${post.id}" data-item-index="${index}" ${checkedAttr}>
                    <span class="notion-todo-text">${escapeHtml(item.text)}</span>
                    ${dateHTML}
                </label>
            `;
        });
        contentAreaHTML = `<div class="notion-todo-list">${itemsHTML}</div>`;
    } else {
        contentAreaHTML = formatPostText(post.text);
    }

    const shareTitle = `Archive by ${displayName}`;
    const shareText = post.text ? (post.text.length > 100 ? post.text.substring(0, 100) + '...' : post.text) : 'Check out this archive!';

    card.innerHTML = `
        <div class="archive-header">
            <img src="${displayAvatar}" alt="${displayName}" class="archive-avatar" onclick="showProfileView()" title="View Profile" style="cursor: pointer;">
            <div class="archive-header-info">
                <div class="archive-name">${escapeHtml(displayName)}</div>
                <div class="archive-meta">
                    <span class="category-badge ${badgeClass}">
                        <i class="fas ${iconMap[post.category]}"></i> ${catName}
                    </span>
                    <span>·</span>
                    <span>${timeStr}</span>
                </div>
            </div>
            <div class="post-menu-container">
                <button class="archive-menu-btn" onclick="togglePostMenu('${post.id}', event)" title="Options">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
                <div class="post-menu-dropdown" id="post-menu-${post.id}">
                    <button class="post-menu-item" onclick="editPost('${post.id}')">
                        <i class="fas fa-pen"></i> Edit
                    </button>
                    <button class="post-menu-item delete" onclick="deletePostById('${post.id}')">
                        <i class="fas fa-trash-alt"></i> Delete
                    </button>
                </div>
            </div>
        </div>
        ${contentAreaHTML}
        ${mediaHTML}
        <div class="archive-actions">
            <button class="action-btn" onclick="toggleCommentBox('${post.id}')">
                <i class="far fa-comment"></i>
                <span>${post.comments ? post.comments.length : 0}</span>
            </button>
            <button class="action-btn" onclick="sharePost('${post.id}', this)" data-title="${escapeHtml(shareTitle)}" data-text="${escapeHtml(shareText)}">
                <i class="fas fa-share"></i>
                <span>Share</span>
            </button>
        </div>
        ${commentsHtml}
    `;

    return card;
}

// See More / See Less helper for posts
function formatPostText(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    const words = escaped.split(/\s+/).filter(w => w.length > 0);
    const limit = 15; // Limit to 15 words for "see more"

    if (words.length <= limit) {
        return `<div class="archive-text">${escaped.replace(/\n/g, '<br>')}</div>`;
    }

    const shortText = words.slice(0, limit).join(' ');

    return `
        <div class="archive-text post-content-wrapper collapsed" onclick="togglePostContent(this, event)">
            <span class="post-text-short">${shortText}... <span class="see-more-btn">see more</span></span>
            <span class="post-text-full">${escaped.replace(/\n/g, '<br>')}</span>
        </div>
    `;
}

function togglePostContent(element, event) {
    const isCollapsed = element.classList.contains('collapsed');
    if (isCollapsed) {
        element.classList.remove('collapsed');
        element.classList.add('expanded');
    } else {
        element.classList.remove('expanded');
        element.classList.add('collapsed');
    }
}


function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return minutes + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 7) return days + 'd ago';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ POST ACTIONS ============

async function deletePostById(id) {
    if (!confirm('Are you sure you want to delete this archive?')) return;
    try {
        await deletePost(id);
        if (!isNaN(Number(id))) {
            await deletePost(Number(id));
        }
        await renderFeed();
        await updateStats();
    } catch (err) {
        console.error('Error deleting post:', err);
    }
}

function sharePost(id, btnElement) {
    try {
        const shareTitle = btnElement ? btnElement.dataset.title : 'Archive Sadrian';
        const shareText = btnElement ? btnElement.dataset.text : 'Check out this archive!';
        // Use the API route for Facebook/Twitter scraping support
        const shareUrl = `${window.location.origin}/api/share?id=${id}&title=${encodeURIComponent(shareTitle)}&text=${encodeURIComponent(shareText)}`;

        if (navigator.share) {
            navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl
            }).catch((err) => {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                    copyToClipboard(shareUrl); // fallback
                }
            });
        } else {
            copyToClipboard(shareUrl);
        }
    } catch (err) {
        console.error('Error sharing:', err);
        copyToClipboard(window.location.origin + window.location.pathname + '?post=' + id);
    }
}

function copyToClipboard(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copied to clipboard!');
        }).catch(() => {
            execCopy(url);
        });
    } else {
        execCopy(url);
    }
}

function execCopy(text) {
    try {
        const input = document.createElement('textarea');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Link copied to clipboard!');
    } catch (e) {
        console.error('Exec copy failed', e);
        showToast('Failed to copy link.');
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function toggleCommentBox(id) {
    const section = document.getElementById(`comments-section-${id}`);
    if (section) {
        if (section.style.display === 'none') {
            section.style.display = 'block';
            const textarea = document.getElementById(`comment-text-${id}`);
            if (textarea) {
                textarea.focus();
                textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            section.style.display = 'none';
        }
    }
}

async function submitComment(id) {
    try {
        const textInput = document.getElementById(`comment-text-${id}`);
        const emailInput = document.getElementById(`comment-email-${id}`);

        if (!textInput) return;

        const text = textInput.value.trim();
        if (!text) return;

        let userEmail = '';
        if (isAdmin) {
            userEmail = auth.currentUser.email.toLowerCase();
        } else {
            if (!emailInput) return;
            userEmail = emailInput.value.trim().toLowerCase();
            if (!userEmail || !userEmail.includes('@')) {
                alert("Please enter a valid email to comment.");
                return;
            }
            localStorage.setItem('visitorEmail', userEmail);
        }

        const posts = await getAllPosts();
        const post = posts.find(p => String(p.id) === String(id));
        if (!post) return;

        const profile = getProfile();

        post.comments = post.comments || [];
        post.comments.push({
            id: Date.now().toString(),
            text: text,
            authorEmail: userEmail,
            author: auth.currentUser ? profile.name : userEmail.split('@')[0],
            timestamp: Date.now(),
            replies: []
        });

        await updatePostComments(post.id, post.comments);
        await renderFeed();
    } catch (err) {
        console.error('Error adding comment:', err);
        alert('Could not save comment. Please check your internet and try again.');
    }
}

function showReplyForm(postId, commentId) {
    const form = document.getElementById(`reply-form-${postId}-${commentId}`);
    if (form) {
        form.classList.toggle('active');
        if (form.classList.contains('active')) {
            const textarea = document.getElementById(`reply-text-${postId}-${commentId}`);
            if (textarea) textarea.focus();
        }
    }
}

async function submitReply(postId, commentId) {
    try {
        const textInput = document.getElementById(`reply-text-${postId}-${commentId}`);
        const emailInput = document.getElementById(`reply-email-${postId}-${commentId}`);

        if (!textInput) return;

        const text = textInput.value.trim();
        if (!text) return;

        let userEmail = '';
        if (isAdmin) {
            userEmail = auth.currentUser.email.toLowerCase();
        } else {
            if (!emailInput) return;
            userEmail = emailInput.value.trim().toLowerCase();
            if (!userEmail || !userEmail.includes('@')) {
                alert("Please enter a valid email to reply.");
                return;
            }
            localStorage.setItem('visitorEmail', userEmail);
        }

        const posts = await getAllPosts();
        const post = posts.find(p => String(p.id) === String(postId));
        if (!post) return;

        const comment = post.comments.find(c => String(c.id || c.timestamp) === String(commentId));
        if (!comment) return;

        const profile = getProfile();

        comment.replies = comment.replies || [];
        comment.replies.push({
            id: Date.now().toString(),
            text: text,
            authorEmail: userEmail,
            author: auth.currentUser ? profile.name : userEmail.split('@')[0],
            timestamp: Date.now()
        });

        await updatePostComments(post.id, post.comments);
        await renderFeed();
    } catch (err) {
        console.error('Error adding reply:', err);
        alert('Could not save reply. Please check your internet and try again.');
    }
}

async function deleteComment(postId, commentId, parentId = null) {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to delete this?')) return;

    try {
        const posts = await getAllPosts();
        const post = posts.find(p => String(p.id) === String(postId));
        if (!post) return;

        if (parentId) {
            // It's a reply
            const parentComment = post.comments.find(c => String(c.id || c.timestamp) === String(parentId));
            if (parentComment && parentComment.replies) {
                parentComment.replies = parentComment.replies.filter(r => String(r.id || r.timestamp) !== String(commentId));
            }
        } else {
            // It's a main comment
            post.comments = post.comments.filter(c => String(c.id || c.timestamp) !== String(commentId));
        }

        await updatePost(post);
        await renderFeed();
    } catch (err) {
        console.error('Error deleting comment:', err);
    }
}

function showProfileView() {
    const feedViewSection = document.getElementById('feed-view-section');
    const profileViewSection = document.getElementById('profile-view-section');
    if (feedViewSection && profileViewSection) {
        feedViewSection.style.display = 'none';
        profileViewSection.style.display = 'flex';
        document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    }
}

// ============ IMAGE MODAL ============

function openImageModal(src) {
    modalImage.src = src;
    imageModal.classList.add('active');
}

modalClose.addEventListener('click', () => {
    imageModal.classList.remove('active');
    modalImage.src = '';
});

imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        imageModal.classList.remove('active');
        modalImage.src = '';
    }
});

// ============ STATS & COUNTS ============

async function updateStats() {
    try {
        const posts = await getAllPosts();
        const total = posts.length;
        const ideas = posts.filter(p => p.category === 'ideas').length;
        const events = posts.filter(p => p.category === 'events').length;
        const achievements = posts.filter(p => p.category === 'achievements').length;
        const tasks = posts.filter(p => p.category === 'tasks').length;
        const notes = posts.filter(p => p.category === 'notes').length;

        // Update header tab counts
        document.getElementById('count-all').textContent = total;
        document.getElementById('count-ideas').textContent = ideas;
        document.getElementById('count-events').textContent = events;
        document.getElementById('count-achievements').textContent = achievements;
        document.getElementById('count-tasks').textContent = tasks;
        const notesEl = document.getElementById('count-notes');
        if (notesEl) notesEl.textContent = notes;
    } catch (err) {
        console.error('Error updating stats:', err);
    }
}

async function updateCategoryCounts() {
    try {
        const posts = await getAllPosts();
        document.getElementById('count-all').textContent = posts.length;
        document.getElementById('count-ideas').textContent = posts.filter(p => p.category === 'ideas').length;
        document.getElementById('count-events').textContent = posts.filter(p => p.category === 'events').length;
        document.getElementById('count-achievements').textContent = posts.filter(p => p.category === 'achievements').length;
        document.getElementById('count-tasks').textContent = posts.filter(p => p.category === 'tasks').length;
        const notesEl = document.getElementById('count-notes');
        if (notesEl) notesEl.textContent = posts.filter(p => p.category === 'notes').length;
    } catch (err) {
        console.error('Error updating category counts:', err);
    }
}

// ============ PROFILE SETTINGS ============

function applyProfileToUI() {
    const profile = getProfile();

    // Header avatar
    headerAvatarImg.src = profile.avatar;

    // Sidebar profile card
    profileAvatarImg.src = profile.avatar;
    profileName.textContent = profile.name;
    profileTitle.textContent = profile.title;
    profileBio.textContent = profile.bio;

    // Banner
    if (profile.banner) {
        profileBanner.style.backgroundImage = `url(${profile.banner})`;
        profileBanner.style.backgroundSize = 'cover';
        profileBanner.style.backgroundPosition = 'center';
    } else {
        profileBanner.style.backgroundImage = '';
        profileBanner.style.background = 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))';
    }

    // Create post avatar
    createPostAvatar.src = profile.avatar;

    // Profile Detailed View Update
    pdAvatar.src = profile.avatar;
    pdName.textContent = profile.name;
    pdTitle.textContent = profile.title;
    pdBio.textContent = profile.bio || 'No bio provided.';
    pdEducation.textContent = profile.education || 'Not specified.';

    // Interests
    pdInterests.innerHTML = '';
    const interestsArray = profile.interests ? profile.interests.split(',').map(s => s.trim()).filter(s => s) : [];
    if (interestsArray.length > 0) {
        interestsArray.forEach(interest => {
            const span = document.createElement('span');
            span.className = 'skill-tag';
            span.textContent = interest;
            pdInterests.appendChild(span);
        });
    } else {
        pdInterests.innerHTML = '<span class="skill-tag">Not specified.</span>';
    }

    if (profile.banner) {
        pdBanner.style.backgroundImage = `url(${profile.banner})`;
        pdBanner.style.backgroundSize = 'cover';
        pdBanner.style.backgroundPosition = 'center';
    } else {
        pdBanner.style.backgroundImage = '';
        pdBanner.style.background = 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))';
    }

    // Skills
    pdSkills.innerHTML = '';
    const skillsArray = profile.skills ? profile.skills.split(',').map(s => s.trim()).filter(s => s) : [];
    if (skillsArray.length > 0) {
        skillsArray.forEach(skill => {
            const span = document.createElement('span');
            span.className = 'skill-tag';
            span.textContent = skill;
            pdSkills.appendChild(span);
        });
    } else {
        pdSkills.innerHTML = '<span class="skill-tag">No skills added</span>';
    }

    // Contact Links (dynamic array)
    pdContactLinks.innerHTML = '';
    const links = profile.contactLinks || [];

    // Also check for legacy fields and migrate them
    if (links.length === 0 && (profile.xUrl || profile.igUrl || profile.email || profile.phone)) {
        if (profile.xUrl) links.push({ type: 'x', value: profile.xUrl });
        if (profile.igUrl) links.push({ type: 'instagram', value: profile.igUrl });
        if (profile.email) links.push({ type: 'email', value: profile.email });
        if (profile.phone) links.push({ type: 'phone', value: profile.phone });
    }

    const iconMap = {
        x: 'fab fa-x-twitter',
        twitter: 'fab fa-x-twitter',
        instagram: 'fab fa-instagram',
        facebook: 'fab fa-facebook',
        linkedin: 'fab fa-linkedin',
        github: 'fab fa-github',
        youtube: 'fab fa-youtube',
        tiktok: 'fab fa-tiktok',
        website: 'fas fa-globe',
        email: 'fas fa-envelope',
        phone: 'fas fa-phone',
        whatsapp: 'fab fa-whatsapp',
        telegram: 'fab fa-telegram',
        discord: 'fab fa-discord',
        other: 'fas fa-link'
    };

    if (links.length > 0) {
        links.forEach(link => {
            const icon = iconMap[link.type] || 'fas fa-link';
            let href = link.value;
            let display = link.value.replace(/^https?:\/\//, '');

            if (link.type === 'email') {
                href = `mailto:${link.value}`;
                display = link.value;
            } else if (link.type === 'phone' || link.type === 'whatsapp') {
                href = `tel:${link.value}`;
                display = link.value;
            } else if (!link.value.startsWith('http')) {
                href = `https://${link.value}`;
            }

            pdContactLinks.innerHTML += `<a href="${href}" target="_blank" class="contact-link-item"><i class="${icon}"></i> ${display}</a>`;
        });
    } else {
        pdContactLinks.innerHTML = '<span style="color: var(--text-muted); font-size: 14px;">No contact info added. Click + to add.</span>';
    }
}

// Navigation between Feed and Profile View
// Home tab already handles returning to feed via category tab click above

profileCard.addEventListener('click', async (e) => {
    if (e.target.closest('#edit-profile-btn') || e.target.closest('#pm-banner-input')) return;
    feedViewSection.style.display = 'none';
    profileViewSection.style.display = 'flex';
});

function openProfileModal() {
    const profile = getProfile();

    // Fill form fields
    pmNameInput.value = profile.name || '';
    pmTitleInput.value = profile.title || '';
    pmBioInput.value = profile.bio || '';
    pmBioCharCount.textContent = (profile.bio ? profile.bio.length : 0) + '/200';

    pmSkillsInput.value = profile.skills || '';
    pmEducationInput.value = profile.education || '';
    pmInterestsInput.value = profile.interests || '';

    // Render dynamic contact link rows
    renderContactRows(profile.contactLinks || []);

    // Preview images
    pmAvatarPreview.src = profile.avatar;

    if (profile.banner) {
        pmBannerPreview.style.backgroundImage = `url(${profile.banner})`;
        pmBannerPreview.style.backgroundSize = 'cover';
        pmBannerPreview.style.backgroundPosition = 'center';
    } else {
        pmBannerPreview.style.backgroundImage = '';
        pmBannerPreview.style.background = 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))';
    }

    // Reset temp
    tempProfileAvatar = null;
    tempProfileBanner = null;

    profileModal.classList.add('active');
}

function closeProfileModal() {
    profileModal.classList.remove('active');
    tempProfileAvatar = null;
    tempProfileBanner = null;
}

function renderContactRows(links) {
    pmContactList.innerHTML = '';
    links.forEach(link => {
        addContactRow(link.type, link.value);
    });
}

function addContactRow(type = 'website', value = '') {
    const row = document.createElement('div');
    row.className = 'contact-row';

    const contactTypes = [
        { value: 'x', label: 'X (Twitter)' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'facebook', label: 'Facebook' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'github', label: 'GitHub' },
        { value: 'youtube', label: 'YouTube' },
        { value: 'tiktok', label: 'TikTok' },
        { value: 'website', label: 'Website' },
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'telegram', label: 'Telegram' },
        { value: 'discord', label: 'Discord' },
        { value: 'other', label: 'Other' }
    ];

    let selectHTML = `<select class="contact-type-select">`;
    contactTypes.forEach(t => {
        const selected = t.value === type ? 'selected' : '';
        selectHTML += `<option value="${t.value}" ${selected}>${t.label}</option>`;
    });
    selectHTML += `</select>`;

    row.innerHTML = `
        ${selectHTML}
        <input type="text" class="contact-value-input" value="${escapeHtml(value)}" placeholder="Username, URL, email or number">
        <button type="button" class="contact-row-remove" title="Remove link">
            <i class="fas fa-times"></i>
        </button>
    `;

    row.querySelector('.contact-row-remove').addEventListener('click', () => {
        row.remove();
    });

    pmContactList.appendChild(row);

    const input = row.querySelector('.contact-value-input');
    if (input && value === '') {
        input.focus();
    }
}

function getContactRowsData() {
    const rows = pmContactList.querySelectorAll('.contact-row');
    const links = [];
    rows.forEach(row => {
        const type = row.querySelector('.contact-type-select').value;
        const value = row.querySelector('.contact-value-input').value.trim();
        if (value) {
            links.push({ type, value });
        }
    });
    return links;
}

// Event listeners for contact links
if (pmAddLinkBtn) {
    pmAddLinkBtn.addEventListener('click', () => {
        addContactRow();
    });
}

if (pdAddContactBtn) {
    pdAddContactBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openProfileModal();
        addContactRow();
    });
}


// Open modal ONLY from explicit edit buttons
editProfileBtn.addEventListener('click', openProfileModal);

// Header profile btn goes to Profile Detailed View instead of Edit Modal
headerProfileBtn.addEventListener('click', () => {
    feedViewSection.style.display = 'none';
    profileViewSection.style.display = 'flex';

    // Optional: deselect tabs to indicate we are in profile view
    document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
});


// Close modal
profileModalClose.addEventListener('click', closeProfileModal);
pmCancelBtn.addEventListener('click', closeProfileModal);

profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
        closeProfileModal();
    }
});

// Bio character counter
pmBioInput.addEventListener('input', () => {
    pmBioCharCount.textContent = pmBioInput.value.length + '/200';
});

// Avatar upload in modal
pmAvatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const dataURL = await readFileAsDataURL(file);
    const resized = await resizeImage(dataURL, 400);
    tempProfileAvatar = resized;
    pmAvatarPreview.src = resized;
    pmAvatarInput.value = '';
});

// Banner upload in modal
pmBannerInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const dataURL = await readFileAsDataURL(file);
    const resized = await resizeImage(dataURL, 1200);
    tempProfileBanner = resized;
    pmBannerPreview.style.backgroundImage = `url(${resized})`;
    pmBannerPreview.style.backgroundSize = 'cover';
    pmBannerPreview.style.backgroundPosition = 'center';
    pmBannerInput.value = '';
});

// Save profile
pmSaveBtn.addEventListener('click', async () => {
    const profile = getProfile();

    profile.name = pmNameInput.value.trim() || defaultProfile.name;
    profile.title = pmTitleInput.value.trim() || defaultProfile.title;
    profile.bio = pmBioInput.value.trim();
    profile.skills = pmSkillsInput.value.trim();
    profile.education = pmEducationInput.value.trim();
    profile.interests = pmInterestsInput.value.trim();

    // Gather dynamic contact links
    profile.contactLinks = getContactRowsData();
    // Remove legacy fields
    delete profile.xUrl;
    delete profile.igUrl;
    delete profile.phone;
    delete profile.email;

    if (tempProfileAvatar) {
        profile.avatar = tempProfileAvatar;
    }
    if (tempProfileBanner) {
        profile.banner = tempProfileBanner;
    }

    await saveProfile(profile);
    applyProfileToUI();
    renderFeed(); // Re-render posts with new profile info
    closeProfileModal();

    // If profile view is open, refresh it
    if (profileViewSection.style.display !== 'none') {
        renderActivityFeed();
    }
});

// ============ EXPORT / IMPORT ============

exportBtn.addEventListener('click', async () => {
    try {
        const posts = await getAllPosts();
        const profile = getProfile();
        const data = {
            app: 'Archive.Sadrian',
            version: '2.0',
            exportedAt: new Date().toISOString(),
            profile: profile,
            posts: posts
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `archive-sadrian-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error exporting:', err);
        alert('Failed to export data.');
    }
});

importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.posts || !Array.isArray(data.posts)) {
            alert('Invalid backup file format.');
            return;
        }

        if (!confirm(`Import ${data.posts.length} archives? This will add to your existing data.`)) {
            return;
        }

        // Import profile if present
        if (data.profile) {
            await saveProfile(data.profile);
            applyProfileToUI();
        }

        for (const post of data.posts) {
            // Remove id so it gets a new auto-increment id
            delete post.id;
            await addPost(post);
        }

        await renderFeed();
        alert('Import successful!');
    } catch (err) {
        console.error('Error importing:', err);
        alert('Failed to import data. Make sure the file is a valid JSON backup.');
    } finally {
        importFile.value = '';
    }
});



// ============ EDIT POST AND MENU ============

function togglePostMenu(id, event) {
    event.stopPropagation();
    document.querySelectorAll('.post-menu-dropdown').forEach(menu => {
        if (menu.id !== `post-menu-${id}`) {
            menu.classList.remove('active');
        }
    });

    const menu = document.getElementById(`post-menu-${id}`);
    if (menu) {
        menu.classList.toggle('active');
    }
}

document.addEventListener('click', () => {
    document.querySelectorAll('.post-menu-dropdown').forEach(menu => {
        menu.classList.remove('active');
    });
});

const editPostModal = document.getElementById('edit-post-modal');
const editPostText = document.getElementById('edit-post-text');
const editPostCloseBtn = document.getElementById('edit-post-modal-close');
const editPostCancelBtn = document.getElementById('edit-post-cancel-btn');
const editPostSaveBtn = document.getElementById('edit-post-save-btn');
let currentEditingPostId = null;

async function editPost(id) {
    try {
        const posts = await getAllPosts();
        const post = posts.find(p => String(p.id) === String(id));
        if (!post) return;

        currentEditingPostId = post.id;
        
        if (post.category === 'tasks' && post.todoList && post.todoList.length > 0) {
            editPostText.value = post.todoList.map(item => item.text).join('\n');
        } else {
            editPostText.value = post.text || '';
        }
        
        editPostModal.classList.add('active');
    } catch (err) {
        console.error('Error fetching post for edit:', err);
    }
}

function closeEditPostModal() {
    if (editPostModal) editPostModal.classList.remove('active');
    currentEditingPostId = null;
    if (editPostText) editPostText.value = '';
}

if (editPostCloseBtn) editPostCloseBtn.addEventListener('click', closeEditPostModal);
if (editPostCancelBtn) editPostCancelBtn.addEventListener('click', closeEditPostModal);
if (editPostModal) {
    editPostModal.addEventListener('click', (e) => {
        if (e.target === editPostModal) closeEditPostModal();
    });
}

if (editPostSaveBtn) {
    editPostSaveBtn.addEventListener('click', async () => {
        if (currentEditingPostId === null) return;

        try {
            const posts = await getAllPosts();
            const post = posts.find(p => String(p.id) === String(currentEditingPostId));
            if (post) {
                const newText = editPostText.value.trim();
                post.text = newText;
                
                if (post.category === 'tasks') {
                    const newLines = newText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    post.todoList = newLines.map(line => {
                        let cleanLine = line.replace(/^-\s*\[\s*\]\s*/, '').replace(/^-\s*/, '');
                        // Preserve completion state if text is unchanged
                        const existing = post.todoList ? post.todoList.find(item => item.text === cleanLine) : null;
                        return {
                            text: cleanLine,
                            completed: existing ? existing.completed : false,
                            completedDate: existing ? existing.completedDate : null
                        };
                    });
                }
                
                await updatePost(post);
                await renderFeed();
            }
            closeEditPostModal();
        } catch (err) {
            console.error('Error updating post:', err);
            alert('Failed to update post.');
        }
    });
}

// ============ INITIALIZATION ============

async function init() {
    try {
        await openDB();

        windowProfile = await getProfileFromDB();

        // Apply saved profile to UI
        applyProfileToUI();

        await renderFeed();

        isInitResolved = true;
        checkAndHideLoader();
    } catch (err) {
        console.error('Initialization error:', err);
        feedContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: var(--accent-orange);"></i>
                <h3>Error loading app</h3>
                <p>Please check the browser console for details.</p>
            </div>
        `;
    }
}

init();

// ============ NOTIFICATION SYSTEM ============

const NOTIF_KEY = 'sadrian_notif_seen';

// Get a map of { postId_commentId: replyCount } that we've already seen
function getSeenReplyCounts() {
    try {
        return JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
    } catch { return {}; }
}

function saveSeenReplyCounts(data) {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(data));
}

async function checkNotifications() {
    const posts = await getAllPosts();
    const seen = getSeenReplyCounts();
    const notifications = [];

    posts.forEach(post => {
        if (!post.comments || post.comments.length === 0) return;
        post.comments.forEach(comment => {
            const key = `${post.id}_${comment.id || comment.timestamp}`;
            const currentCount = (comment.replies || []).length;
            const seenCount = seen[key] ?? currentCount; // if never seen, mark as seen right now

            // If new replies appeared since we last checked
            if (currentCount > seenCount) {
                const newReplies = (comment.replies || []).slice(seenCount);
                newReplies.forEach(reply => {
                    notifications.push({
                        postId: post.id,
                        commentId: comment.id || comment.timestamp,
                        postText: post.text || post.title || 'a post',
                        commenter: comment.authorEmail || comment.author || 'Someone',
                        replier: reply.authorEmail || reply.author || 'Someone',
                        time: reply.timestamp,
                        key: key
                    });
                });
            }

            // First time seeing — mark current count as seen so existing replies don't show as "new"
            if (!(key in seen)) {
                seen[key] = currentCount;
            }
        });
    });

    // Save updated seen state (only for keys that newly appeared)
    // Don't overwrite — just add missing keys
    posts.forEach(post => {
        if (!post.comments) return;
        post.comments.forEach(comment => {
            const key = `${post.id}_${comment.id || comment.timestamp}`;
            if (!(key in seen)) {
                seen[key] = (comment.replies || []).length;
            }
        });
    });
    saveSeenReplyCounts(seen);

    renderNotifications(notifications);
}

function renderNotifications(notifications) {
    const badge = document.getElementById('notif-badge');
    const bellBtn = document.getElementById('notif-bell-btn');
    const list = document.getElementById('notif-list');
    if (!badge || !bellBtn || !list) return;

    if (notifications.length === 0) {
        badge.style.display = 'none';
        bellBtn.classList.remove('has-notif');
        list.innerHTML = '<div class="notif-empty"><i class="far fa-bell-slash" style="font-size:24px;margin-bottom:8px;display:block"></i>No new notifications</div>';
        return;
    }

    badge.style.display = 'flex';
    badge.textContent = notifications.length > 9 ? '9+' : notifications.length;
    bellBtn.classList.add('has-notif');

    list.innerHTML = notifications.map(n => `
        <div class="notif-item unread" data-post-id="${n.postId}" data-comment-id="${n.commentId}">
            <div class="notif-icon"><i class="fas fa-reply"></i></div>
            <div class="notif-content">
                <div class="notif-text"><strong>${escapeHtml(n.replier)}</strong> replied to a comment on your post</div>
                <div class="notif-post-preview">"${escapeHtml((n.postText || '').substring(0, 60))}..."</div>
                <div class="notif-time">${formatDate(new Date(n.time))}</div>
            </div>
        </div>
    `).join('');

    // Click on notification → scroll to post & open comment section
    list.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', () => {
            const postId = item.dataset.postId;
            const commentId = item.dataset.commentId;
            goToComment(postId, commentId);
            // Mark this notification as read
            item.classList.remove('unread');
            // Close dropdown
            document.getElementById('notif-dropdown').classList.remove('open');
        });
    });
}

function goToComment(postId, commentId) {
    // First, make sure we're on feed view
    const feedView = document.getElementById('feed-view-section');
    const profileView = document.getElementById('profile-view-section');
    if (feedView) feedView.classList.add('active');
    if (profileView) profileView.classList.remove('active');

    // Find the post card
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postCard) return;

    // Open the comment section
    const commentSection = document.getElementById(`comments-section-${postId}`);
    if (commentSection) {
        commentSection.style.display = 'block';
    }

    // Scroll to the post card
    postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight the specific comment briefly
    setTimeout(() => {
        const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (commentEl) {
            commentEl.style.transition = 'background 0.3s';
            commentEl.style.background = 'rgba(59,130,246,0.15)';
            setTimeout(() => { commentEl.style.background = ''; }, 2000);
            commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 500);
}

function markAllNotifsRead() {
    const bellBtn = document.getElementById('notif-bell-btn');
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');

    // Save current reply counts so nothing is "new" anymore
    getAllPosts().then(posts => {
        const seen = getSeenReplyCounts();
        posts.forEach(post => {
            if (!post.comments) return;
            post.comments.forEach(comment => {
                const key = `${post.id}_${comment.id || comment.timestamp}`;
                seen[key] = (comment.replies || []).length;
            });
        });
        saveSeenReplyCounts(seen);
    });

    if (badge) badge.style.display = 'none';
    if (bellBtn) bellBtn.classList.remove('has-notif');
    if (list) list.innerHTML = '<div class="notif-empty"><i class="far fa-bell-slash" style="font-size:24px;margin-bottom:8px;display:block"></i>No new notifications</div>';
}

// Bell button toggle
document.addEventListener('DOMContentLoaded', () => {
    const bellBtn = document.getElementById('notif-bell-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const markAllBtn = document.getElementById('notif-mark-all');

    if (bellBtn && dropdown) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isAdmin) return; // admin only
            dropdown.classList.toggle('open');
            if (dropdown.classList.contains('open')) {
                checkNotifications(); // refresh when opened
            }
        });
    }

    if (markAllBtn) {
        markAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            markAllNotifsRead();
        });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (dropdown && !dropdown.contains(e.target) && e.target !== bellBtn) {
            dropdown.classList.remove('open');
        }
    });

    // Poll for new notifications every 30 seconds (admin only)
    setTimeout(() => { if (isAdmin) checkNotifications(); }, 3000);
    setInterval(() => { if (isAdmin) checkNotifications(); }, 30000);
});

// ============ GLOBAL INTERACTIVE HANDLERS ============

// 1. Carousel navigation logic
function navigateCarousel(container, direction) {
    const slides = container.querySelectorAll('.carousel-slide');
    const dots = container.querySelectorAll('.indicator-dot');
    const prevBtn = container.querySelector('.carousel-prev');
    const nextBtn = container.querySelector('.carousel-next');

    let index = parseInt(container.dataset.activeIndex || '0', 10);
    index += direction;

    if (index < 0) index = 0;
    if (index >= slides.length) index = slides.length - 1;

    container.dataset.activeIndex = index;

    // Slide transition
    const slidesWrapper = container.querySelector('.carousel-slides');
    if (slidesWrapper) {
        slidesWrapper.style.transform = `translateX(-${index * 100}%)`;
    }

    // Update dots
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === index);
    });

    // Update arrow buttons visibility
    if (prevBtn) prevBtn.style.opacity = index === 0 ? '0' : '1';
    if (nextBtn) nextBtn.style.opacity = index === slides.length - 1 ? '0' : '1';
}

// Carousel button click delegation
document.addEventListener('click', (e) => {
    const prev = e.target.closest('.carousel-prev');
    if (prev) {
        const container = prev.closest('.carousel-container');
        navigateCarousel(container, -1);
        return;
    }
    const next = e.target.closest('.carousel-next');
    if (next) {
        const container = next.closest('.carousel-container');
        navigateCarousel(container, 1);
        return;
    }
});

// Carousel swipe delegation for touchscreens (mobile devices)
let touchStartX = 0;
let touchStartY = 0;
document.addEventListener('touchstart', (e) => {
    const container = e.target.closest('.carousel-container');
    if (!container) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
    const container = e.target.closest('.carousel-container');
    if (!container) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) {
            navigateCarousel(container, -1); // Swipe right (prev)
        } else {
            navigateCarousel(container, 1);  // Swipe left (next)
        }
    }
}, { passive: true });


// 2. Notion-style Checklist change delegation
document.addEventListener('change', async (e) => {
    if (e.target.classList.contains('notion-todo-checkbox')) {
        const checkbox = e.target;
        if (!isAdmin) {
            e.preventDefault();
            checkbox.checked = !checkbox.checked; // revert
            alert('Only the admin can update tasks.');
            return;
        }

        const postId = checkbox.dataset.postId;
        const index = parseInt(checkbox.dataset.itemIndex, 10);
        const checked = checkbox.checked;
        const label = checkbox.closest('.notion-todo-item');

        // Visual feedback immediately
        if (label) {
            label.classList.toggle('completed', checked);
            let dateEl = label.querySelector('.todo-completed-date');
            if (checked) {
                const now = new Date();
                const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                if (!dateEl) {
                    dateEl = document.createElement('span');
                    dateEl.className = 'todo-completed-date';
                    label.appendChild(dateEl);
                }
                dateEl.innerHTML = `<i class="fas fa-check"></i> ${dateStr}`;
            } else if (dateEl) {
                dateEl.remove();
            }
        }

        try {
            const posts = await getAllPosts();
            const post = posts.find(p => String(p.id) === String(postId));
            if (post && post.todoList && post.todoList[index]) {
                post.todoList[index].completed = checked;
                post.todoList[index].completedDate = checked ? Date.now() : null;

                // Save status in firebase (publicly allowed write on posts comment/fields path)
                await updatePost(post);
            }
        } catch (err) {
            console.error('Error updating todo status:', err);
            // Revert visual state on error
            checkbox.checked = !checked;
            if (label) {
                label.classList.toggle('completed', !checked);
            }
            alert('Failed to save task status. Check your internet connection.');
        }
    }
});
