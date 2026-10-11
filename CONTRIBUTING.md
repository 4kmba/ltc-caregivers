# 작업 방법

이 저장소는 문서 중심으로 운영하며, 모든 작업은 `main` 브랜치에 직접 커밋합니다. 코드가 생기면 그때 브랜치와 pull request로 전환합니다.

## 처음 한 번

```bash
git clone https://github.com/4kmba/ltc-caregivers.git
cd ltc-caregivers
sh setup.sh
```

`setup.sh`는 이 저장소에만 적용되는 설정 세 가지를 합니다.

- `git pull`이 항상 rebase 방식으로 동작하게 합니다. 원격 커밋 위에 내 커밋을 얹어 merge 커밋이 생기지 않습니다.
- 저장소 안의 `.githooks/`를 hook 폴더로 씁니다. push 직전에 아래 규칙을 자동으로 확인합니다.
- 커밋에 기록할 이름과 이메일을 묻습니다. 이메일은 GitHub가 계정마다 발급하는 `ID+username@users.noreply.github.com` 주소를 권장합니다. GitHub Settings → Emails에서 확인할 수 있고, 같은 화면의 "Keep my email addresses private"를 켜면 웹에서 편집한 커밋도 그 주소로 기록됩니다.

커밋 이메일이 GitHub 계정에 등록된 주소와 다르면 커밋은 올라가도 그 사람의 기여로 집계되지 않습니다. noreply 주소는 계정에 연결돼 있으면서 공개 저장소에 노출돼도 실제 메일함이 아니라서 쓰는 것입니다. 실제 이메일을 공개해도 괜찮다면 `git config team.allowPublicEmail true`로 경고를 끌 수 있습니다.

## 매번

```bash
git pull
git add <파일>
git commit -m "<무엇을 왜 바꿨는지 한 줄>"
git push
```

- push 전에 `git pull`을 먼저 합니다. 원격이 앞서 있으면 hook이 멈추고 안내합니다.
- 작업 단위마다 작게 자주 커밋합니다. 여러 사람의 작업을 한 사람이 모아서 올리지 않습니다.
- 두 사람이 함께 쓴 문서는 커밋 메시지 마지막 줄에 `Co-authored-by: 이름 <이메일>`을 넣으면 두 사람 모두의 기여로 기록됩니다.

## `main` 브랜치 규칙

GitHub 저장소 설정(ruleset)으로 두 가지를 강제합니다.

- **Linear history:** merge 커밋은 거부됩니다. `git pull`을 rebase 없이 해서 merge 커밋이 생겼다면 `git pull --rebase origin main`으로 정리한 뒤 다시 push 합니다.
- **Force push 금지:** 이미 올라간 커밋을 덮어쓸 수 없습니다. 되돌려야 하면 `git revert`로 새 커밋을 만듭니다.

## 문서 위치

| 내용 | 위치 |
|---|---|
| 프로젝트 정의, 질문, premortem | `docs/PROJECT.md`, `docs/QUESTIONS.md`, `docs/PREMORTEM.md`, `docs/premortem/<이름>.md` |
| 인터뷰 가이드와 기록 | `docs/interviews/YYYY-MM-DD-<대상>.md` |
| 회의록 | `docs/meetings/YYYY-MM-DD.md` |
| 리서치, 비교, 요약 | `docs/` 바로 아래 |

문서는 한국어로 쓰고, 파일 입출력은 UTF-8을 씁니다. `.docx`나 `.hwp`가 아니라 `.md`로 저장합니다.
