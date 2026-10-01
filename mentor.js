const SUPABASE_URL = 'https://zbytsducqtvmbnatzuyl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpieXRzZHVjcXR2bWJuYXR6dXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjMzODQsImV4cCI6MjEwNjQzOTM4NH0.JUJiVV-I5Qtu7L_FMnhioS4xgEi9uTV1B_ZlBb-8zNg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

async function checkUser() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('user-info').innerText = `👤 ${currentUser.email}`;
        
        loadSOS();
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
                options: { 
                    redirectTo: 'https://apkrub.github.io/ST69-Chatting-with-TA/mentor.html' 
                }
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
}

// โหลดและจัดการ SOS
async function loadSOS() {
    const { data, error } = await sb.from('sos_requests').select('*').order('created_at', { ascending: false });
    if (error) return;

    const container = document.getElementById('mentor-sos-list');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400">ยังไม่มีเคสเรียกความช่วยเหลือในขณะนี้</p>`;
        return;
    }

    container.innerHTML = data.map(sos => `
        <div class="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <div class="flex items-center gap-2">
                    <span class="bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-lg text-sm">${sos.table_no}</span>
                    <span class="text-xs text-slate-400">ผู้ส่ง: ${sos.student_email || 'ไม่ระบุ'}</span>
                </div>
                <p class="text-slate-800 font-medium mt-2">📌 ปัญหา: ${sos.topic}</p>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span class="px-3 py-1 text-xs rounded-full font-medium ${
                    sos.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    sos.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }">
                    ${sos.status === 'pending' ? '⏳ รอรับเคส' : sos.status === 'in_progress' ? '🏃‍♂️ กำลังไป' : '✅ เคลียร์แล้ว'}
                </span>
                
                ${sos.status !== 'resolved' ? `
                    <button onclick="updateSOSStatus('${sos.id}', '${sos.status === 'pending' ? 'in_progress' : 'resolvedこと' in window ? '' : 'resolved'}')" class="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg hover:bg-slate-800 transition">
                        ${sos.status === 'pending' ? 'รับเคสนี้' : 'เคลียร์แล้ว'}
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function updateSOSStatus(id, newStatus) {
    const { error } = await sb.from('sos_requests').update({ 
        status: newStatus,
        mentor_email: currentUser.email 
    }).eq('id', id);

    if (error) alert('อัปเดตไม่สำเร็จ: ' + error.message);
}

// ฟังก์ชันให้พี่ๆ พิมพ์ประกาศส่งขึ้นเว็บ
async function postAnnouncement() {
    const title = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();
    if (!title || !content) {
        alert('กรุณากรอกหัวข้อและเนื้อหาประกาศ');
        return;
    }

    const { error } = await sb.from('announcements').insert([{ title, content }]);
    if (!error) {
        alert('📢 สร้างประกาศสำเร็จ!');
        document.getElementById('ann-title').value = '';
        document.getElementById('ann-content').value = '';
        switchTab('dashboard');
    } else {
        alert('เกิดข้อผิดพลาด: ' + error.message);
    }
}

function setupRealtime() {
    sb.channel('mentor-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_requests' }, () => loadSOS())
        .subscribe();
}

checkUser();
