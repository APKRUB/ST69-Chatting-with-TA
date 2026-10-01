const SUPABASE_URL = 'https://zbytsducqtvmbnatzuyl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpieXRzZHVjcXR2bWJuYXR6dXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjMzODQsImV4cCI6MjEwNjQzOTM4NH0.JUJiVV-I5Qtu7L_FMnhioS4xgEi9uTV1B_ZlBb-8zNg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let activeTable = null;

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
        
        loadSOS();
        loadTableList();
        setupRealtime();
    } else {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            await sb.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: 'https://apkrub.github.io/ST69-Chatting-with-TA/mentor.html' }
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
    if (tabName === 'chat-rooms') loadTableList();
}

async function loadSOS() {
    const { data, error } = await sb.from('sos_requests').select('*').order('created_at', { ascending: false });
    if (error) return;

    const container = document.getElementById('mentor-sos-list');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400">ยังไม่มีเคสเรียกความช่วยเหลือ</p>`;
        return;
    }

    container.innerHTML = data.map(sos => `
        <div class="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <div class="flex items-center gap-2">
                    <span class="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold px-3 py-1 rounded-lg text-sm">${sos.table_no}</span>
                    <span class="text-xs text-slate-400">ผู้ส่ง: ${sos.student_email || 'ไม่ระบุ'}</span>
                </div>
                <p class="text-slate-800 dark:text-slate-200 font-medium mt-2">📌 ปัญหา: ${sos.topic}</p>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span class="px-3 py-1 text-xs rounded-full font-medium ${
                    sos.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                    sos.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                }">
                    ${sos.status === 'pending' ? '⏳ รอรับเคส' : sos.status === 'in_progress' ? '🏃‍♂️ กำลังไป' : '✅ เคลียร์แล้ว'}
                </span>
                
                ${sos.status !== 'resolved' ? `
                    <button onclick="updateSOSStatus('${sos.id}', '${sos.status === 'pending' ? 'in_progress' : 'resolved'}')" class="bg-slate-900 dark:bg-slate-800 text-white text-xs px-3 py-2 rounded-lg hover:bg-slate-800 transition">
                        ${sos.status === 'pending' ? 'รับเคสนี้' : 'เคลียร์แล้ว'}
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function updateSOSStatus(id, newStatus) {
    await sb.from('sos_requests').update({ 
        status: newStatus,
        mentor_email: currentUser.email 
    }).eq('id', id);
}

async function loadTableList() {
    const { data, error } = await sb.from('messages').select('table_no').not('table_no', 'is', null);
    if (error) return;

    const tables = [...new Set(data.map(item => item.table_no))];
    const container = document.getElementById('table-list');
    if (!container) return;
    
    if (tables.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400">ยังไม่มีโต๊ะทักแชทมา</p>`;
        return;
    }

    container.innerHTML = tables.map(table => `
        <button onclick="selectChatTable('${table}')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 font-medium text-sm transition ${activeTable === table ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}">
            📌 ${table}
        </button>
    `).join('');
}

function selectChatTable(table) {
    activeTable = table;
    const titleEl = document.getElementById('active-chat-title');
    if(titleEl) titleEl.innerText = `กำลังคุยกับ: ${table}`;
    loadMentorMessages();
    loadTableList();
}

async function loadMentorMessages() {
    if (!activeTable) return;
    const { data, error } = await sb.from('messages')
        .select('*')
        .eq('table_no', activeTable)
        .order('created_at', { ascending: true });
        
    if (error) return;

    const container = document.getElementById('mentor-chat-messages');
    if(!container) return;

    container.innerHTML = data.map(msg => `
        <div class="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm max-w-md border border-slate-100 dark:border-slate-800 ${msg.sender_email === currentUser.email ? 'ml-auto bg-indigo-50/50 dark:bg-indigo-950/40' : ''}">
            <p class="text-xs text-slate-400 mb-1">${msg.sender_email}</p>
            <p class="text-sm text-slate-700 dark:text-slate-200">${msg.content}</p>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

// ป้องกัน Error 400 ฝั่งพี่เลี้ยง
async function sendMentorMessage() {
    if (!activeTable) {
        alert('กรุณาเลือกโต๊ะทางซ้ายมือก่อนตอบกลับ');
        return;
    }
    const input = document.getElementById('mentor-chat-input');
    const content = input.value.trim();
    if (!content) return;

    const { error } = await sb.from('messages').insert({
        sender_id: currentUser.id,
        sender_email: currentUser.email,
        table_no: activeTable,
        content: content
    });

    if (!error) {
        input.value = '';
        loadMentorMessages();
    } else {
        alert('ตอบกลับไม่สำเร็จ: ' + error.message);
    }
}

async function postAnnouncement() {
    const title = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();
    if (!title || !content) {
        alert('กรุณากรอกหัวข้อและเนื้อหาประกาศ');
        return;
    }

    const { error } = await sb.from('announcements').insert({ title, content });
    if (!error) {
        alert('📢 สร้างประกาศสำเร็จ!');
        document.getElementById('ann-title').value = '';
        document.getElementById('ann-content').value = '';
        switchTab('dashboard');
    }
}

function setupRealtime() {
    sb.channel('public:mentor-channel')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'sos_requests' 
        }, () => {
            loadSOS();
        })
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages' 
        }, payload => {
            loadTableList(); // อัปเดตรายชื่อโต๊ะทางซ้ายมือทันที
            if (activeTable && payload.new.table_no === activeTable) {
                loadMentorMessages(); // ถ้ากำลังเปิดดูโต๊ะนั้นอยู่ ให้ข้อความเด้งขึ้นมาทันที
            }
        })
        .subscribe();
}

// ผูกฟังก์ชันเข้ากับ window
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.updateSOSStatus = updateSOSStatus;
window.selectChatTable = selectChatTable;
window.sendMentorMessage = sendMentorMessage;
window.postAnnouncement = postAnnouncement;

checkUser();
