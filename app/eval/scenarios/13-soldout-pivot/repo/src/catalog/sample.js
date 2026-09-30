// 예제와 시험에 쓰는 작은 상품 목록

export const SAMPLE_PRODUCTS = [
  { id: 'tb-001', name: '스탠리 클래식 텀블러 1L', brand: '스탠리', category: 'kitchen/tumbler', tags: ['보온', '보냉', '대용량'], price: 45000, listPrice: 52000, stock: 0, restockAt: '10-15', popularity: 980, createdAt: '2026-03-02', description: '진공 단열 스테인리스 텀블러' },
  { id: 'tb-002', name: '써모스 슬림 텀블러 500ml', brand: '써모스', category: 'kitchen/tumbler', tags: ['보온', '슬림'], price: 29000, stock: 42, popularity: 610, createdAt: '2026-05-11', description: '가방에 쏙 들어가는 슬림 텀블러' },
  { id: 'tb-003', name: '락앤락 원터치 텀블러', brand: '락앤락', category: 'kitchen/tumbler', tags: ['원터치', '보냉'], price: 18900, stock: 2, popularity: 420, createdAt: '2026-01-20', description: '한 손으로 여는 텀블러' },
  { id: 'tb-004', name: '스탠리 어드벤처 텀블러 887ml', brand: '스탠리', category: 'kitchen/tumbler', tags: ['보냉', '캠핑'], price: 39000, stock: 15, popularity: 530, createdAt: '2026-06-01', description: '손잡이 달린 대용량 텀블러' },
  { id: 'tb-005', name: '킨토 트래블 텀블러', brand: '킨토', category: 'kitchen/tumbler', tags: ['보온', '디자인'], price: 33000, stock: 0, popularity: 700, createdAt: '2026-02-14', description: '심플한 디자인 텀블러' },
  { id: 'bt-001', name: '날진 와이드 물병 1L', brand: '날진', category: 'outdoor/bottle', tags: ['캠핑', '등산'], price: 22000, stock: 30, popularity: 350, createdAt: '2025-11-03', description: '튼튼한 트라이탄 보틀' },
  { id: 'bt-002', name: '하이드로플라스크 보온병 750ml', brand: '하이드로플라스크', category: 'outdoor/bottle', tags: ['보온', '보냉'], price: 49000, stock: 8, popularity: 460, createdAt: '2026-04-09', description: '24시간 보냉 보온병' },
  { id: 'mg-001', name: '이딸라 머그컵 300ml', brand: '이딸라', category: 'kitchen/mug', tags: ['도자기', '디자인'], price: 27000, stock: 11, popularity: 220, createdAt: '2025-09-18', description: '북유럽 디자인 머그' },
  { id: 'mg-002', name: '스탠리 캠프 머그 350ml', brand: '스탠리', category: 'kitchen/mug', tags: ['캠핑', '보온'], price: 25000, stock: 0, popularity: 300, createdAt: '2026-05-30', description: '캠핑용 스테인리스 머그' },
  { id: 'ck-001', name: '원목 도마 대형', brand: '나무공방', category: 'kitchen/cookware', tags: ['원목'], price: 35000, stock: 6, popularity: 140, createdAt: '2025-12-01', description: '호두나무 원목 도마' },
  { id: 'cp-001', name: '헬리녹스 체어원 캠핑의자', brand: '헬리녹스', category: 'outdoor/camping', tags: ['캠핑', '경량'], price: 149000, stock: 4, popularity: 390, createdAt: '2026-03-21', description: '가벼운 캠핑 의자' },
  { id: 'cp-002', name: '코베아 캠핑 버너', brand: '코베아', category: 'outdoor/camping', tags: ['캠핑', '취사'], price: 59000, stock: 0, popularity: 270, createdAt: '2025-10-10', description: '휴대용 가스 버너' },
  { id: 'sh-001', name: '뉴발란스 993 운동화', brand: '뉴발란스', category: 'fashion/shoes', tags: ['러닝', '데일리'], price: 259000, stock: 3, popularity: 820, createdAt: '2026-04-01', description: '편한 데일리 스니커즈' },
  { id: 'sh-002', name: '반스 올드스쿨 스니커즈', brand: '반스', category: 'fashion/shoes', tags: ['데일리'], price: 79000, stock: 25, popularity: 640, createdAt: '2025-08-15', description: '클래식 캔버스 운동화' },
  { id: 'tp-001', name: '챔피온 리버스위브 후드티', brand: '챔피온', category: 'fashion/top', tags: ['데일리', '기모'], price: 119000, listPrice: 139000, stock: 9, popularity: 510, createdAt: '2025-10-28', description: '두툼한 기모 후드' },
  { id: 'au-001', name: '소니 무선 이어폰 WF-1000XM5', brand: '소니', category: 'digital/audio', tags: ['노이즈캔슬링', '블루투스'], price: 329000, stock: 0, popularity: 900, createdAt: '2026-01-05', description: '노이즈 캔슬링 이어버드' },
  { id: 'au-002', name: 'QCY 무선 이어폰 T13', brand: 'QCY', category: 'digital/audio', tags: ['블루투스', '가성비'], price: 19900, stock: 120, popularity: 750, createdAt: '2025-12-12', description: '가성비 블루투스 이어폰' },
  { id: 'pc-001', name: 'LG 그램 노트북 16', brand: 'LG', category: 'digital/computer', tags: ['경량', '업무'], price: 1890000, stock: 5, popularity: 480, createdAt: '2026-02-02', description: '가벼운 16인치 노트북' },
  { id: 'gc-001', name: '모바일 상품권 3만원', brand: '기프트', category: 'etc', tags: ['선물'], price: 30000, stock: null, popularity: 200, createdAt: '2025-07-01', description: '문자로 보내는 상품권' },
]

export const SAMPLE_ORDERS = [
  ['tb-002', 'mg-001'],
  ['tb-004', 'cp-001', 'cp-002'],
  ['cp-001', 'cp-002', 'bt-001'],
  ['sh-001', 'tp-001'],
  ['sh-002', 'tp-001'],
  ['au-002', 'pc-001'],
  ['tb-002', 'bt-002'],
  ['cp-001', 'mg-002'],
]
