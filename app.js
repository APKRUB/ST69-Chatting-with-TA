// ตั้งค่าการเชื่อมต่อ Supabase (เปลี่ยนค่าด้านล่างนี้เป็นของตัวเอง)
const SUPABASE_URL = 'https://zbytsducqtvmbnatzuyl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpieXRzZHVjcXR2bWJuYXR6dXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjMzODQsImV4cCI6MjEwNjQzOTM4NH0.JUJiVV-I5Qtu7L_FMnhioS4xgEi9uTV1B_ZlBb-8zNg';
supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// 1. ตรวจสอบสถานะการล็อกอินเมื่อเปิดเว็บ
async function checkUser() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('user-info').innerText = `👤 ${currentUser.email}`;
        
        // โหลดข้อมูลเริ่มต้นทั้งหมด
        loadMessages();
        loadAnnouncements();
        loadSOS();
        
        // เปิดระบบ Realtime
        setupRealtime();
    } else {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
}

// 2. ผูก Event ให้ปุ่ม Login เมื่อหน้าเว็บโหลดเสร็จ (ป้องกันกดแล้วเงียบ)
window.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            console.log("กำลังพยายามเชื่อมต่อ Google OAuth...");
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) {
                alert('Login Error: ' + error.message);
                console.error(error);
            }
        });
    } else {
        console.error("หาปุ่ม login-btn ไม่พบในหน้า HTML!");
    }
});

// 3. ปุ่ม Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
});

// 4. สลับหน้าแท็บเมนู
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
}

// ==========================================
// 5. ระบบแชท (Realtime Chat)
// ==========================================
async function loadMessages() {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (error) return;
    
    const container = document.getElementById('chat-messages');
    container.innerHTML = data.map(msg => `
        <div class="p-3 bg-white rounded-xl shadow-sm max-w-md border border-slate-100 ${msg.sender_id === currentUser.id ? 'ml-auto bg-indigo-50/50' : ''}">
            <p class="text-sm text-slate-700">${msg.content}</p>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    const { error } = await supabase.from('messages').insert([{
        sender_id: currentUser.id,
        content: content
    }]);

    if (!error) {
        input.value = '';
    } else {
        alert('ส่งข้อความไม่สำเร็จ: ' + error.message);
    }
}

// ==========================================
// 6. ระบบกดเรียกพี่ (SOS & Mentor Dashboard)
// ==========================================
async function sendSOS() {
    const tableNo = document.getElementById('sos-table').value.trim();
    const topic = document.getElementById('sos-topic').value.trim();
    if (!tableNo || !topic) {
        alert('กรุณากรอกเลขที่โต๊ะและหัวข้อที่ติดปัญหาให้ครบถ้วน');
        return;
    }

    const { error } = await supabase.from('sos_requests').insert([{
        student_id: currentUser.id,
        student_email: currentUser.email,
        table_no: tableNo,
        topic: topic,
        status: 'pending'
    }]);

    if (!error) {
        alert('🚨 ส่งสัญญาณเรียกพี่สำเร็จ พี่ๆ กำลังไปหาครับ!');
        document.getElementById('sos-topic').value = '';
        switchTab('chat'); // ส่งเสร็จเด้งไปหน้าแชทรอ
    } else {
        alert('ส่ง SOS ไม่สำเร็จ: ' + error.message);
    }
}

async function loadSOS() {
    const { data, error } = await supabase.from('sos_requests').select('*').order('created_at', { ascending: false });
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
                    <button onclick="updateSOSStatus('${sos.id}', '${sos.status === 'pending' ? 'in_progress' : 'resolved'}')" class="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg hover:bg-slate-800 transition">
                        ${sos.status === 'pending' ? 'รับเคสนี้' : 'ทำเครื่องหมายว่าเคลียร์แล้ว'}
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

async function updateSOSStatus(id, newStatus) {
    const { error } = await supabase.from('sos_requests').update({ 
        status: newStatus,
        mentor_email: currentUser.email 
    }).eq('id', id);

    if (error) alert('อัปเดตสถานะไม่สำเร็จ: ' + error.message);
}

// ==========================================
// 7. ระบบประกาศ (Announcements)
// ==========================================
async function loadAnnouncements() {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) return;

    const container = document.getElementById('announcement-list');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400">ยังไม่มีประกาศจากค่ายในขณะนี้</p>`;
        return;
    }

    container.innerHTML = data.map(ann => `
        <div class="p-4 bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-indigo-600">
            <h3 class="font-bold text-slate-800">${ann.title}</h3>
            <p class="text-sm text-slate-600 mt-1">${ann.content}</p>
        </div>
    `).join('');
}

// ==========================================
// 8. Supabase Realtime Subscription
// ==========================================
function setupRealtime() {
    supabase.channel('camp-realtime-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            loadMessages();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_requests' }, payload => {
            loadSOS();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, payload => {
            loadAnnouncements();
        })
        .subscribe();
}

// เริ่มต้นตรวจสอบ User ทันทีที่โหลดสคริปต์
checkUser();
