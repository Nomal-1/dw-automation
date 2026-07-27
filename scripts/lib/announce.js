// 자동화가 실제로 적용됐을 때 채팅에 한 줄 알림을 남긴다.
// 플레이어가 "이 액션이 발동했는지"를 다이얼로그를 다시 안 열어봐도 알 수 있게 하기 위함.
export function announceActionApplied(actor, moveLabel, detail = "") {
  const content = `
    <p class="dwauto-action-applied">
      <i class="fas fa-check-circle"></i>
      ${game.i18n.format("DWAUTO.ActionApplied", { move: moveLabel })}
      ${detail ? `<br><span class="dwauto-action-detail">${detail}</span>` : ""}
    </p>
  `;
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content
  });
}
