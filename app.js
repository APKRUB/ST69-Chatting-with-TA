// ตั้งค่าการเชื่อมต่อ Supabase (เปลี่ยนค่าด้านล่างนี้เป็นของตัวเอง)
const SUPABASE_URL = 'https://zbytsducqtvmbnatzuyl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpieXRzZHVjcXR2bWJuYXR6dXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjMzODQsImV4cCI6MjEwNjQzOTM4NH0.JUJiVV-I5Qtu7L_FMnhioS4xgEi9uTV1B_ZlBb-8zNg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let myTable = localStorage.getItem('my_table') || '';
let lastReadAnn = Number(localStorage.getItem('last_read_ann') || 0);
let lastReadChat = Number(localStorage.getItem('last_read_chat') || 0);

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
        
        if (myTable) {
            document.getElementById('my-table-no').value = myTable;
        }
        loadMessages();
        loadAnnouncements();
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
                options: { redirectTo: 'https://apkrub.github.io/ST69-Chatting-with-TA/' }
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

    if (tabName === 'announcement') {
        lastReadAnn = Date.now();
        localStorage.setItem('last_read_ann', lastReadAnn);
        document.getElementById('badge-ann').classList.add('hidden');
    }
    if (tabName === 'chat') {
        lastReadChat = Date.now();
        localStorage.setItem('last_read_chat', lastReadChat);
        document.getElementById('badge-chat').classList.add('hidden');
        loadMessages();
    }
}

function changeMyTable() {
    myTable = document.getElementById('my-table-no').value.trim();
    localStorage.setItem('my_table', myTable);
    loadMessages();
}

async function loadMessages() {
    if (!myTable) {
        document.getElementById('chat-messages').innerHTML = `<p class="text-center text-slate-400 mt-10">กรุณาระบุเลขที่โต๊ะด้านบนก่อนเริ่มแชทครับ</p>`;
        return;
    }

    const { data, error } = await sb.from('messages')
        .select('*')
        .eq('table_no', myTable)
        .order('created_at', { ascending: true });
        
    if (error) return;
    
    const container = document.getElementById('chat-messages');
    container.innerHTML = data.map(msg => `
        <div class="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm max-w-md border border-slate-100 dark:border-slate-800 ${msg.sender_id === currentUser.id ? 'ml-auto bg-indigo-50/50 dark:bg-indigo-950/40' : ''}">
            <p class="text-xs text-slate-400 mb-1">${msg.sender_id === currentUser.id ? 'คุณ' : 'พี่เลี้ยง'}</p>
            <p class="text-sm text-slate-700 dark:text-slate-200">${msg.content}</p>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;

    // ตรวจสอบข้อความใหม่เพื่อแสดงจุดแดง
    if (data.length > 0) {
        const latestMsg = data[data.length - 1];
        if (latestMsg.sender_id !== currentUser.id && new Date(latestMsg.created_at).getTime() > lastReadChat && document.getElementById('tab-chat').classList.contains('hidden')) {
            document.getElementById('badge-chat').classList.remove('hidden');
        }
    }
}

async function sendMessage() {
    if (!myTable) {
        alert('กรุณาระบุเลขที่โต๊ะก่อนส่งข้อความครับ');
        return;
    }
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    const { error } = await sb.from('messages').insert({
        sender_id: currentUser.id,
        sender_email: currentUser.email,
        table_no: myTable,
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
        table_no: tableNo,
        topic: topic,
        status: 'pending'
    });

    if (!error) {
        alert('🚨 ส่งสัญญาณเรียกพี่สำเร็จ!');
        document.getElementById('sos-topic').value = '';
        switchTab('chat');
    }
}

async function loadAnnouncements() {
    const { data, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) return;

    const container = document.getElementById('announcement-list');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400">ยังไม่มีประกาศจากค่าย</p>`;
        return;
    }

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
    sb.channel('student-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            if (payload.new.table_no === myTable) {
                loadMessages();
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
            loadAnnouncements();
        })
        .subscribe();
}

window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.changeMyTable = changeMyTable;
window.sendMessage = sendMessage;
window.sendSOS = sendSOS;

checkUser();
