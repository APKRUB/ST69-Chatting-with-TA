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
        loadMentorPolls();
        loadMentorAnnouncements();
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
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.remove('hidden');
    
    if (tabName === 'chat-rooms') {
        document.getElementById('badge-mentor-chat').classList.add('hidden');
        loadTableList();
    }
    if (tabName === 'polls') loadMentorPolls();
    if (tabName === 'post-announcement') loadMentorAnnouncements();
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
                    <span class="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold px-3 py-1 rounded-lg text-sm">ผู้เรียก: ${sos.table_no}</span>
                </div>
                <p class="text-slate-800 dark:text-slate-200 font-medium mt-2">📌 ปัญหา: ${sos.topic}</p>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span class="px-3 py-1 text-xs rounded-full font-medium ${
                    sos.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    sos.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }">
                    ${sos.status === 'pending' ? '⏳ รอรับเคส' : sos.status === 'in_progress' ? '🏃‍♂️ กำลังไป' : '✅ เคลียร์แล้ว'}
                </span>
                ${sos.status !== 'resolved' ? `
                    <button onclick="updateSOSStatus('${sos.id}', 'in_progress')" class="bg-slate-900 dark:bg-slate-800 text-white text-xs px-3 py-2 rounded-lg">รับเคส</button>
                    <button onclick="updateSOSStatus('${sos.id}', 'resolved')" class="bg-green-600 text-white text-xs px-3 py-2 rounded-lg">เสร็จสิ้น</button>
                ` : ''}
                <button onclick="deleteSOS('${sos.id}')" class="text-xs bg-red-50 text-red-600 px-2.5 py-2 rounded-lg">🗑 ลบ</button>
            </div>
        </div>
    `).join('');
}

async function updateSOSStatus(id, newStatus) {
    await sb.from('sos_requests').update({ status: newStatus, mentor_email: currentUser.email }).eq('id', id);
    loadSOS();
}

async function deleteSOS(id) {
    if (!confirm('ลบเคสนี้หรือไม่?')) return;
    await sb.from('sos_requests').delete().eq('id', id);
    loadSOS();
}

async function createPoll() {
    const question = document.getElementById('poll-question').value.trim();
    const optionsRaw = document.getElementById('poll-options').value.trim();
    const expiresAt = document.getElementById('poll-expires').value;

    if (!question || !optionsRaw) {
        alert('กรุณากรอกคำถามและตัวเลือก');
        return;
    }

    const options = optionsRaw.split(',').map(o => o.trim()).filter(Boolean);

    const { error } = await sb.from('polls').insert({
        question,
        options,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
    });

    if (!error) {
        alert('🚀 สร้าง Poll สำเร็จ!');
        document.getElementById('poll-question').value = '';
        document.getElementById('poll-options').value = '';
        document.getElementById('poll-expires').value = '';
        loadMentorPolls();
    } else {
        alert('สร้างไม่สำเร็จ: ' + error.message);
    }
}

async function loadMentorPolls() {
    const { data: polls } = await sb.from('polls').select('*').order('created_at', { ascending: false });
    const { data: votes } = await sb.from('poll_votes').select('*');

    const container = document.getElementById('mentor-poll-results');
    if (!container) return;

    if (!polls || polls.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400">ยังไม่มี Poll ในระบบ</p>`;
        return;
    }

    container.innerHTML = polls.map(poll => {
        const pollVotes = (votes || []).filter(v => v.poll_id === poll.id);
        const totalVotes = pollVotes.length;

        return `
            <div class="p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
                <div class="flex justify-between items-start">
                    <h4 class="font-bold text-base">${poll.question}</h4>
                    <button onclick="deletePoll('${poll.id}')" class="text-xs text-red-500 hover:underline">ลบ Poll</button>
                </div>
                <p class="text-xs text-slate-400">จำนวนคนโหวตทั้งหมด: <b>${totalVotes}</b> คน ${poll.expires_at ? `(ปิด: ${new Date(poll.expires_at).toLocaleString('th-TH')})` : ''}</p>
                <div class="space-y-2">
                    ${poll.options.map((opt, idx) => {
                        const count = pollVotes.filter(v => v.selected_option === idx).length;
                        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        return `
                            <div>
                                <div class="flex justify-between text-xs mb-1 font-medium">
                                    <span>${opt}</span>
                                    <span>${count} คน (${percent}%)</span>
                                </div>
                                <div class="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                    <div class="bg-indigo-600 h-full rounded-full transition-all duration-500" style="width: ${percent}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

async function deletePoll(pollId) {
    if (!confirm('ต้องการลบ Poll นี้ใช่หรือไม่?')) return;
    await sb.from('polls').delete().eq('id', pollId);
    loadMentorPolls();
}

async function loadTableList() {
    const { data: msgData } = await sb.from('messages').select('table_no, sender_name').not('sender_name', 'is', null);
    const names = [...new Set((msgData || []).map(i => i.sender_name))];

    const container = document.getElementById('table-list');
    if (!container) return;
    if (names.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400">ยังไม่มีผู้ใช้งานส่งข้อความ</p>`;
        return;
    }
    container.innerHTML = names.map(name => `
        <button onclick="selectChatUser('${name}')" class="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 font-medium text-sm transition ${activeTable === name ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600' : 'text-slate-700 dark:text-slate-300'}">
            📌 ${name}
        </button>
    `).join('');
}

function selectChatUser(name) {
    activeTable = name;
    document.getElementById('active-chat-title').innerText = `กำลังคุยกับ: ${name}`;
    loadMentorMessages();
}

async function loadMentorMessages() {
    if (!activeTable) return;
    const { data } = await sb.from('messages').select('*').eq('sender_name', activeTable).order('created_at', { ascending: true });
    const container = document.getElementById('mentor-chat-messages');
    if (!container) return;
    container.innerHTML = (data || []).map(msg => `
        <div class="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm max-w-md border border-slate-100 dark:border-slate-800 ${msg.sender_email === currentUser?.email ? 'ml-auto bg-indigo-50/50' : ''}">
            <p class="text-xs text-slate-400 mb-1">${msg.sender_name || msg.sender_email}</p>
            <p class="text-sm text-slate-700 dark:text-slate-200">${msg.content}</p>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendMentorMessage() {
    if (!activeTable) return alert('กรุณาเลือกผู้ใช้งานทางซ้าย');
    const input = document.getElementById('mentor-chat-input');
    const content = input.value.trim();
    if (!content) return;

    await sb.from('messages').insert({
        sender_id: currentUser.id,
        sender_email: currentUser.email,
        sender_name: `พี่เลี้ยง (${currentUser.email})`,
        table_no: activeTable,
        content: content
    });
    input.value = '';
    loadMentorMessages();
}

async function clearMentorChat() {
    if (!activeTable || !confirm('เคลียร์แชทนี้หรือไม่?')) return;
    await sb.from('messages').delete().eq('sender_name', activeTable);
    loadMentorMessages();
}

async function loadMentorAnnouncements() {
    const { data } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('mentor-announcement-list');
    if (!container || !data) return;
    container.innerHTML = data.map(ann => `
        <div class="p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-start gap-3">
            <div>
                <h4 class="font-bold text-slate-800 dark:text-slate-100">${ann.title}</h4>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">${ann.content}</p>
            </div>
            <button onclick="deleteAnnouncement('${ann.id}')" class="text-xs bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg">🗑 ลบ</button>
        </div>
    `).join('');
}

async function saveAnnouncement() {
    const title = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();
    if (!title || !content) return;
    await sb.from('announcements').insert({ title, content });
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-content').value = '';
    loadMentorAnnouncements();
}

async function deleteAnnouncement(id) {
    await sb.from('announcements').delete().eq('id', id);
    loadMentorAnnouncements();
}

function setupRealtime() {
    sb.channel('mentor-rt')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_requests' }, () => loadSOS())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { loadTableList(); loadMentorMessages(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => loadMentorPolls())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => loadMentorPolls())
        .subscribe();
}

window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.updateSOSStatus = updateSOSStatus;
window.deleteSOS = deleteSOS;
window.createPoll = createPoll;
window.deletePoll = deletePoll;
window.selectChatUser = selectChatUser;
window.sendMentorMessage = sendMentorMessage;
window.clearMentorChat = clearMentorChat;
window.saveAnnouncement = saveAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;

checkUser();
