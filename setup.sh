#!/bin/sh
# 이 저장소를 clone한 뒤 저장소 루트에서 한 번 실행한다.
#   sh setup.sh
# 하는 일: pull을 rebase 방식으로 고정하고, 저장소 안의 hook을 켜고,
# 커밋에 기록할 이름과 이메일을 이 저장소에만 설정한다.

set -e
cd "$(dirname "$0")"

if [ ! -d .git ]; then
  echo "git 저장소 루트에서 실행해 주세요."
  exit 1
fi

git config pull.rebase true
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

current_name=$(git config user.name 2>/dev/null || true)
current_email=$(git config user.email 2>/dev/null || true)

printf '커밋에 기록할 이름 [%s]: ' "$current_name"
read -r name
printf '커밋에 기록할 이메일 (GitHub noreply 주소 권장) [%s]: ' "$current_email"
read -r email

[ -n "$name" ] && git config user.name "$name"
[ -n "$email" ] && git config user.email "$email"

final_email=$(git config user.email 2>/dev/null || true)
case "$final_email" in
  *@users.noreply.github.com)
    ;;
  "")
    echo
    echo "이메일이 비어 있습니다. push 전에 다시 실행해 주세요."
    ;;
  *)
    echo
    echo "주의: $final_email 은(는) 공개 저장소의 모든 커밋에 그대로 남습니다."
    echo "GitHub Settings > Emails 에서 'ID+username@users.noreply.github.com' 주소를 확인해"
    echo "그 주소로 다시 실행하는 것을 권장합니다."
    echo "이 주소를 그대로 쓰려면:  git config team.allowPublicEmail true"
    ;;
esac

echo
echo "설정 완료"
echo "  user.name       = $(git config user.name)"
echo "  user.email      = $(git config user.email)"
echo "  pull.rebase     = $(git config pull.rebase)"
echo "  core.hooksPath  = $(git config core.hooksPath)"
