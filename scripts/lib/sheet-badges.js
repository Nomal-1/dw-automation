// 던전월드 시트의 무브 목록 템플릿은 그 무브가 rollType이나 rollFormula를
// 가진 경우에만 ".item-meta.tags" 컨테이너(태그 칩 자리)를 그려준다. 굴림
// 없이 그냥 발동하는 패시브 무브(Smite류, Balance 등)는 이 컨테이너 자체가
// 없어서, 배지를 붙일 자리가 없으면 무브 이름 바로 뒤에 직접 만들어 붙인다.
// 여러 기능(attack-assistant.js의 조건부 데미지 배지, druid.js의 조화 배지 등)이
// 같은 문제를 겪어서 공용으로 뺐다.
export function getOrCreateTagsContainer($item) {
  const existing = $item.find(".item-meta.tags");
  if (existing.length) return existing.first();

  const $created = $('<div class="item-meta tags"></div>');
  const $name = $item.find(".item-name");
  if ($name.length) {
    $name.after($created);
  } else {
    $item.prepend($created);
  }
  return $created;
}
