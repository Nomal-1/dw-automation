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

// "이번에 새로 뭔가 적용됐다"가 아니라, "예전에 이미 이렇게 정해졌다"를
// 다시 보여줄 때 쓴다(예: 이미 완료된 클래스 부여 무브를 다시 발동했을 때).
// announceActionApplied와 아이콘을 다르게 써서 "지금 처리됨"과 "이미 정해진
// 상태를 다시 알려줌"을 구분한다.
export function announceInfo(actor, content) {
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p class="dwauto-action-applied"><i class="fas fa-circle-info"></i> ${content}</p>`
  });
}
