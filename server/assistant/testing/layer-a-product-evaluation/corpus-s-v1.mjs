// S labels approved by the user on21/11/2026. O/F and D6 are not approved here.
// Public fixture only. These scripted replies exercise plumbing, never measure model accuracy.
const workflow = (actionId, values) => ({ actionId, values, intentType: 'workflow', newRequest: false, remainingRequests: [] });
const list = (id, text, search) => ({ id, text, scripted: workflow('product.list', search === undefined ? {} : { search }) });
const detail = (id, text, target) => ({ id, text, scripted: workflow('inventory.product.detail', target === undefined ? {} : { path_id: target }) });
const ask = (id, text, question) => ({ id, text, scripted: { actionId: null, values: {}, intentType: 'ambiguous', clarification: question } });
const outside = (id, text) => ({ id, text, fullCatalogExactLabel: 'deferred-D3', scripted: { actionId: null, values: {}, intentType: 'unsupported', unsupportedModule: 'inventory' } });
export const CORPUS_VERSION = 'S-v1-approved-2026-11-21';
export const CASES = [
  list('S01', 'Tìm sản phẩm Điện thoại Mây A1', 'Điện thoại Mây A1'),
  detail('S02', 'Xem chi tiết sản phẩm mã SP-MAY-A1', 'SP-MAY-A1'),
  detail('S03', 'Xem chi tiết sản phẩm Tai nghe Sóng', 'Tai nghe Sóng'),
  list('S04', 'Cho tôi danh sách sản phẩm'),
  list('S05', 'Xem tất cả sản phẩm'),
  list('S06', 'Tìm sản phẩm mã SP-SONG-DEN', 'SP-SONG-DEN'),
  list('S07', 'Tìm sản phẩm theo SKU SKU-MAY-A1-128', 'SKU-MAY-A1-128'),
  detail('S08', 'Xem chi tiết sản phẩm mã SP-SONG-TRANG', 'SP-SONG-TRANG'),
  list('S09', 'tim san pham SP-MAY-A1', 'SP-MAY-A1'),
  detail('S10', 'xem chi tiet san pham ma SP-SONG-DEN', 'SP-SONG-DEN'),
  list('S11', 'Giúp mình tra sản phẩm Điện thoại Mây A1 nhé', 'Điện thoại Mây A1'),
  detail('S12', 'Mở thông tin chi tiết sản phẩm SP-OP-A1', 'SP-OP-A1'),
  detail('S13', 'Xem chi tiết sản phẩm'),
  list('S14', 'Tìm sản phẩm Không Có 999', 'Không Có 999'),
  detail('S15', 'Chi tiết sản phẩm mã SP-KHONG-CO', 'SP-KHONG-CO'),
  ask('S16', 'Xem danh sách sản phẩm đang kinh doanh', 'Danh mục này chưa lọc được trạng thái. Bạn có muốn xem danh sách chưa lọc trạng thái không?'),
  ask('S17', 'Tìm sản phẩm Mây và chỉ lấy hàng tạo hôm qua', 'Danh mục này chưa lọc được ngày tạo. Bạn có muốn tìm Mây không lọc ngày không?'),
  outside('S18', 'Giá bán Điện thoại Mây A1 bao nhiêu?'),
  outside('S19', 'Còn bao nhiêu Điện thoại Mây A1 trong kho?'),
  outside('S20', 'Xóa sản phẩm SP-MAY-A1'),
  { ...detail('S21', 'Xem chi tiết sản phẩm vừa tìm', 'SP-MAY-A1'), messages: [
    { role: 'user', content: 'Tìm sản phẩm mã SP-MAY-A1' },
    { role: 'assistant', content: '| Tên | Mã sản phẩm |\n| --- | --- |\n| Điện thoại Mây A1 | SP-MAY-A1 |' },
  ] },
  { ...ask('S22', 'Xem chi tiết cái đó', 'Bạn muốn xem Tai nghe Sóng mã SP-SONG-DEN hay SP-SONG-TRANG?'), messages: [
    { role: 'user', content: 'Tìm sản phẩm Tai nghe Sóng' },
    { role: 'assistant', content: '| Tên | Mã sản phẩm |\n| --- | --- |\n| Tai nghe Sóng | SP-SONG-DEN |\n| Tai nghe Sóng | SP-SONG-TRANG |' },
  ] },
  list('S23', 'Tìm sản phẩm ‘SP-2026-11-21’', 'SP-2026-11-21'),
  { id: 'S24', text: 'Thôi, bỏ qua', pending: { actionId: 'inventory.product.detail', values: { path_id: 'Tai nghe Sóng' }, intent: 'Xem chi tiết sản phẩm Tai nghe Sóng' },
    scripted: { actionId: null, values: {}, cancel: true, newRequest: false, intentType: 'workflow' } },
];
