// ตั้งค่าการเชื่อมต่อ Supabase (เปลี่ยนค่าด้านล่างนี้เป็นของตัวเอง)
const SUPABASE_URL = 'https://zbytsducqtvmbnatzuyl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpieXRzZHVjcXR2bWJuYXR6dXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjMzODQsImV4cCI6MjEwNjQzOTM4NH0.JUJiVV-I5Qtu7L_FMnhioS4xgEi9uTV1B_ZlBb-8zNg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let userProfile = {
    fullname: localStorage.getItem('profile_fullname') || '',
    nickname: localStorage.getItem('profile_nickname') || '',
    grade: localStorage.getItem('profile_grade') || '',
    dob: localStorage.getItem('profile_dob') || '',
    no: localStorage.getItem('profile_no') || ''
};
let lastReadAnn = Number(localStorage.getItem('last_read_ann') || 0);

function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        const label = document.getElementById('theme-label');
        if(label) label.innerText = 'โหมดสว่าง';
    } else {
        document.documentElement.classList.remove('dark');
        const label = document.getElementById('theme-label');
        if(label) label.innerText = 'โหมดมืด';
    }
}

function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        const label = document.getElementById('theme-label');
        if(label) label.innerText = 'โหมดมืด';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        const label = document.getElementById('theme-label');
        if(label) label.innerText = 'โหมดสว่าง';
    }
}

async function checkUser() {
    initTheme();
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('user-info').innerText = `👤 ${currentUser.email}`;
        
        if (!userProfile.nickname || !userProfile.no) {
            openSettings();
        }

        loadMessages();
        loadAnnouncements();
        loadStudentPolls();
        setupRealtime();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            await sb.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.href }
            });
        });
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.reload();
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    if (tabName === 'poll') loadStudentPolls();
    if (tabName === 'chat') loadMessages();
    if (tabName === 'announcement') {
        lastReadAnn = Date.now();
        localStorage.setItem('last_read_ann', lastReadAnn);
        document.getElementById('badge-ann').classList.add('hidden');
    }
}

function openSettings() {
    document.getElementById('set-fullname').value = userProfile.fullname;
    document.getElementById('set-nickname').value = userProfile.nickname;
    document.getElementById('set-grade').value = userProfile.grade;
    document.getElementById('set-dob').value = userProfile.dob;
    document.getElementById('set-no').value = userProfile.no;
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
    if (!userProfile.nickname || !userProfile.no) {
        alert('กรุณากรอกชื่อเล่นและเลขที่ก่อนใช้งานครับ');
        return;
    }
    document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
    userProfile.fullname = document.getElementById('set-fullname').value.trim();
    userProfile.nickname = document.getElementById('set-nickname').value.trim();
    userProfile.grade = document.getElementById('set-grade').value.trim();
    userProfile.dob = document.getElementById('set-dob').value.trim();
    userProfile.no = document.getElementById('set-no').value.trim();

    if (!userProfile.nickname || !userProfile.no) {
        alert('กรุณากรอกชื่อเล่นและเลขที่ด้วยครับ');
        return;
    }

    localStorage.setItem('profile_fullname', userProfile.fullname);
    localStorage.setItem('profile_nickname', userProfile.nickname);
    localStorage.setItem('profile_grade', userProfile.grade);
    localStorage.setItem('profile_dob', userProfile.dob);
    localStorage.setItem('profile_no', userProfile.no);

    document.getElementById('settings-modal').classList.add('hidden');
    alert('✅ บันทึกข้อมูลเรียบร้อย!');
}

async function loadMessages() {
    const { data, error } = await sb.from('messages').select('*').order('created_at', { ascending: true });
    if (error) return;
    
    const container = document.getElementById('chat-messages');
    container.innerHTML = (data || []).map(msg => {
        const senderDisplay = msg.sender_name || `${msg.table_no || 'ทั่วไป'}-${msg.sender_email}`;
        const isMe = msg.sender_id === currentUser.id;
        return `
            <div class="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm max-w-md border border-slate-100 dark:border-slate-800 ${isMe ? 'ml-auto bg-indigo-50/50 dark:bg-indigo-950/40' : ''}">
                <p class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">📌 ${senderDisplay}</p>
                <p class="text-sm text-slate-700 dark:text-slate-200">${msg.content}</p>
            </div>
        `;
    }).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    const chatDisplayName = `${userProfile.no}-${userProfile.nickname}`;

    const { error } = await sb.from('messages').insert({
        sender_id: currentUser.id,
        sender_email: currentUser.email,
        sender_name: chatDisplayName,
        content: content
    });

    if (!error) {
        input.value = '';
        loadMessages();
    } else {
        alert('ส่งไม่สำเร็จ: ' + error.message);
    }
}

async function sendSOS() {
    const tableNo = document.getElementById('sos-table').value.trim();
    const topic = document.getElementById('sos-topic').value.trim();
    if (!tableNo || !topic) {
        alert('กรุณากรอกเลขที่โต๊ะและหัวข้อให้ครบถ้วน');
        return;
    }

    const { error } = await sb.from('sos_requests').insert({
        student_id: currentUser.id,
        student_email: currentUser.email,
        table_no: `${userProfile.no}-${userProfile.nickname} (โต๊ะ ${tableNo})`,
        topic: topic,
        status: 'pending'
    });

    if (!error) {
        alert('🚨 ส่งสัญญาณเรียกพี่สำเร็จ!');
        document.getElementById('sos-topic').value = '';
        switchTab('chat');
    }
}

async function loadStudentPolls() {
    const { data: polls } = await sb.from('polls').select('*').order('created_at', { ascending: false });
    const { data: myVotes } = await sb.from('poll_votes').select('*').eq('user_id', currentUser.id);
    const votedMap = {};
    (myVotes || []).forEach(v => { votedMap[v.poll_id] = v.selected_option; });

    const container = document.getElementById('student-poll-list');
    if (!container) return;

    if (!polls || polls.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400">ยังไม่มีแบบสำรวจในขณะนี้</p>`;
        return;
    }

    const now = new Date();

    container.innerHTML = polls.map(poll => {
        const isExpired = poll.expires_at && new Date(poll.expires_at) < now;
        const votedIdx = votedMap[poll.id];

        return `
            <div class="p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
                <h3 class="font-bold text-base">${poll.question}</h3>
                ${isExpired ? `<p class="text-xs text-red-500 font-medium">⏳ แบบสำรวจนี้ปิดรับคำตอบแล้ว</p>` : ''}
                <div class="space-y-2">
                    ${poll.options.map((opt, idx) => `
                        <button onclick="votePoll('${poll.id}',${idx})" 
                            class="w-full text-left px-4 py-2.5 rounded-xl text-sm border transition flex justify-between items-center ${votedIdx === idx ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-bold' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}"
                            ${isExpired ? 'disabled' : ''}>
                            <span>${opt}</span>${votedIdx === idx ? '<span>✓ โหวตแล้ว</span>' : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

async function votePoll(pollId, optionIndex) {
    const { data: existing } = await sb.from('poll_votes').select('*').eq('poll_id', pollId).eq('user_id', currentUser.id).single();

    if (existing) {
        await sb.from('poll_votes').update({ selected_option: optionIndex }).eq('id', existing.id);
    } else {
        await sb.from('poll_votes').insert({ poll_id: pollId, user_id: currentUser.id, selected_option: optionIndex });
    }
    alert('✅ บันทึกคะแนนโหวตเรียบร้อย!');
    loadStudentPolls();
}

async function loadAnnouncements() {
    const { data } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('announcement-list');
    if (!container || !data) return;

    container.innerHTML = data.map(ann => `
        <div class="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 border-l-4 border-indigo-600">
            <h3 class="font-bold text-slate-800 dark:text-slate-100">${ann.title}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">${ann.content}</p>
        </div>
    `).join('');

    if (data.length > 0) {
        if (new Date(data[0].created_at).getTime() > lastReadAnn && document.getElementById('tab-announcement').classList.contains('hidden')) {
            document.getElementById('badge-ann').classList.remove('hidden');
        }
    }
}

function setupRealtime() {
    sb.channel('student-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadMessages())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => loadStudentPolls())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => loadAnnouncements())
        .subscribe();
}

window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.sendMessage = sendMessage;
window.sendSOS = sendSOS;
window.votePoll = votePoll;

checkUser();
