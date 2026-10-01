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
        loadMentorAnnouncements();
        setupRealtime();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.remove('hidden'); // ป้องกันหน้าค้างตอนยังไม่ล็อกอิน
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

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await sb.auth.signOut();
        window.location.reload();
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.remove('hidden');
    
    if (tabName === 'chat-rooms') loadTableList();
    if (tabName === 'post-announcement') loadMentorAnnouncements();
}

// --- ระบบ SOS ---
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
                    <button onclick="updateSOSStatus('${sos.id}', 'in_progress')" class="bg-slate-900 dark:bg-slate-800 text-white text-xs px-3 py-2 rounded-lg hover:bg-slate-800 transition">
                        ${sos.status === 'pending' ? 'รับเคสนี้' : 'อัปเดต'}
                    </button>
                    <button onclick="updateSOSStatus('${sos.id}', 'resolved')" class="bg-green-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-green-700 transition">
                        เสร็จสิ้น
                    </button>
                ` : ''}

                <button onclick="deleteSOS('${sos.id}')" class="text-xs bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 px-2.5 py-2 rounded-lg hover:bg-red-100 transition" title="ลบเคสนี้">
                    🗑 ลบ
                </button>
            </div>
        </div>
    `).join('');
}

async function updateSOSStatus(id, newStatus) {
    if (!currentUser) return;
    await sb.from('sos_requests').update({ 
        status: newStatus,
        mentor_email: currentUser.email 
    }).eq('id', id);
    loadSOS();
}

async function deleteSOS(id) {
    if (!confirm('คุณต้องการลบเคส SOS นี้ออกจากประวัติใช่หรือไม่?')) return;

    const { error } = await sb.from('sos_requests').delete().eq('id', id);
    if (!error) {
        loadSOS();
    } else {
        alert('ลบเคสไม่สำเร็จ: ' + error.message);
    }
}

// --- ระบบแชทรายโต๊ะ ---
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
        <div class="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm max-w-md border border-slate-100 dark:border-slate-800 ${msg.sender_email === currentUser?.email ? 'ml-auto bg-indigo-50/50 dark:bg-indigo-950/40' : ''}">
            <p class="text-xs text-slate-400 mb-1">${msg.sender_email}</p>
            <p class="text-sm text-slate-700 dark:text-slate-200">${msg.content}</p>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendMentorMessage() {
    if (!activeTable || !currentUser) {
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

async function clearMentorChat() {
    if (!activeTable) {
        alert('กรุณาเลือกโต๊ะทางซ้ายมือก่อนครับ');
        return;
    }
    if (!confirm(`คุณต้องการลบประวัติแชททั้งหมดของ "${activeTable}" ใช่หรือไม่?`)) return;

    const { error } = await sb.from('messages').delete().eq('table_no', activeTable);

    if (!error) {
        loadMentorMessages();
        loadTableList();
    } else {
        alert('ล้างแชทไม่สำเร็จ: ' + error.message);
    }
}

// --- ระบบจัดการประกาศ (Create, Edit, Delete) ---
async function loadMentorAnnouncements() {
    const { data, error } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) return;

    const container = document.getElementById('mentor-announcement-list');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400">ยังไม่มีประกาศในระบบ</p>`;
        return;
    }

    container.innerHTML = data.map(ann => `
        <div class="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-start gap-3">
            <div>
                <h4 class="font-bold text-slate-800 dark:text-slate-100">${ann.title}</h4>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">${ann.content}</p>
            </div>
            <div class="flex gap-1 shrink-0">
                <button onclick="editAnnouncement('${ann.id}', \`${ann.title.replace(/`/g, '\\`')}\`, \`${ann.content.replace(/`/g, '\\`')}\`)" class="text-xs bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition">✏️ แก้ไข</button>
                <button onclick="deleteAnnouncement('${ann.id}')" class="text-xs bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition">🗑️️ ลบ</button>
            </div>
        </div>
    `).join('');
}

async function saveAnnouncement() {
    const id = document.getElementById('ann-id').value;
    const title = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();

    if (!title || !content) {
        alert('กรุณากรอกหัวข้อและเนื้อหาประกาศ');
        return;
    }

    if (id) {
        const { error } = await sb.from('announcements').update({ title, content }).eq('id', id);
        if (!error) {
            alert('✏️ แก้ไขประกาศสำเร็จ!');
            resetAnnForm();
            loadMentorAnnouncements();
        } else {
            alert('แก้ไขไม่สำเร็จ: ' + error.message);
        }
    } else {
        const { error } = await sb.from('announcements').insert({ title, content });
        if (!error) {
            alert('📢 สร้างประกาศสำเร็จ!');
            resetAnnForm();
            loadMentorAnnouncements();
        } else {
            alert('สร้างไม่สำเร็จ: ' + error.message);
        }
    }
}

function editAnnouncement(id, title, content) {
    document.getElementById('ann-id').value = id;
    document.getElementById('ann-title').value = title;
    document.getElementById('ann-content').value = content;
    document.getElementById('ann-form-title').innerText = '✏️ แก้ไขประกาศ';
    document.getElementById('ann-submit-btn').innerText = 'บันทึกการแก้ไข';
    document.getElementById('ann-cancel-btn').classList.remove('hidden');
    document.getElementById('ann-title').scrollIntoView({ behavior: 'smooth' });
}

function resetAnnForm() {
    document.getElementById('ann-id').value = '';
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-content').value = '';
    document.getElementById('ann-form-title').innerText = '📝 สร้างประกาศใหม่';
    document.getElementById('ann-submit-btn').innerText = '📢 เผยแพร่ประกาศ';
    document.getElementById('ann-cancel-btn').classList.add('hidden');
}

async function deleteAnnouncement(id) {
    if (!confirm('คุณต้องการลบประกาศนี้ใช่หรือไม่?')) return;

    const { error } = await sb.from('announcements').delete().eq('id', id);
    if (!error) {
        loadMentorAnnouncements();
    } else {
        alert('ลบประกาศไม่สำเร็จ: ' + error.message);
    }
}

// --- Realtime ---
function setupRealtime() {
    sb.channel('mentor-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_requests' }, () => loadSOS())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            loadTableList();
            if (activeTable && payload.new.table_no === activeTable) loadMentorMessages();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, () => {
            loadTableList();
            if (activeTable) loadMentorMessages();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
            loadMentorAnnouncements();
        })
        .subscribe();
}

// ผูกฟังก์ชันเข้ากับ window
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.updateSOSStatus = updateSOSStatus;
window.deleteSOS = deleteSOS;
window.selectChatTable = selectChatTable;
window.sendMentorMessage = sendMentorMessage;
window.clearMentorChat = clearMentorChat;
window.saveAnnouncement = saveAnnouncement;
window.editAnnouncement = editAnnouncement;
window.resetAnnForm = resetAnnForm;
window.deleteAnnouncement = deleteAnnouncement;

checkUser();
