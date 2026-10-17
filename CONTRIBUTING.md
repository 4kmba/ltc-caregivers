# 작업 방법

이 저장소의 모든 변경은 **브랜치를 만들어 pull request(PR)로 올리고, squash merge로 `main`에 합칩니다.** `main`에 직접 push하거나 GitHub 웹에서 `main`에 바로 커밋하는 것은 저장소 설정이 막습니다.

## 처음 한 번

```bash
git clone https://github.com/4kmba/ltc-caregivers.git
cd ltc-caregivers
sh setup.sh
```

`setup.sh`는 이 저장소에만 적용되는 설정을 합니다.

- `git pull`이 항상 rebase 방식으로 동작하게 합니다. merge 커밋이 생기지 않습니다.
- 새 브랜치에서 `git push`만 쳐도 같은 이름의 원격 브랜치가 만들어지게 합니다.
- 저장소 안의 `.githooks/`를 hook 폴더로 씁니다. push 직전에 아래 규칙을 자동으로 확인합니다.
- 커밋에 기록할 이름과 이메일을 묻습니다. 이메일은 GitHub가 계정마다 발급하는 `ID+username@users.noreply.github.com` 주소를 권장합니다. GitHub Settings → Emails에서 확인할 수 있고, 같은 화면의 "Keep my email addresses private"를 켜면 웹에서 편집한 커밋도 그 주소로 기록됩니다.

커밋 이메일이 GitHub 계정에 등록된 주소와 다르면 커밋은 올라가도 그 사람의 기여로 집계되지 않습니다. noreply 주소는 계정에 연결돼 있으면서 공개 저장소에 노출돼도 실제 메일함이 아니라서 쓰는 것입니다. 실제 이메일을 공개해도 괜찮다면 `git config team.allowPublicEmail true`로 경고를 끌 수 있습니다.

## 매번: 브랜치 → PR → squash merge

### 터미널에서

```bash
git switch main
git pull
git switch -c <github-id>/<주제>        # 예: mk-baek/interview-guide
# 파일 수정
git add <파일>
git commit -m "<무엇을 왜 바꿨는지 한 줄>"
git push
gh pr create --fill                      # gh가 없으면 push 출력에 뜨는 링크를 열어 PR을 만든다
```

PR이 머지되면 원격 브랜치는 자동으로 지워집니다. 로컬은 `git switch main && git pull`로 돌아오고, 다음 작업은 새 브랜치에서 시작합니다.

### GitHub 웹에서

파일을 편집하거나 업로드한 뒤 커밋 화면에서 **"Create a new branch for this commit and start a pull request"**를 선택합니다. 브랜치 이름은 `<github-id>/<주제>`로 바꾸고, 이어지는 화면에서 PR을 만듭니다. "Commit directly to the main branch"는 저장소 설정이 거부합니다.

### PR 규칙

- 브랜치 이름은 `<github-id>/<주제>`입니다. 브랜치 목록만 봐도 누가 무엇을 하는지 알 수 있습니다.
- PR 하나는 주제 하나입니다. `PROJECT.md` 가설 수정과 `QUESTIONS.md` 갱신처럼 성격이 다른 변경은 PR을 나눕니다.
- PR 제목은 커밋 메시지와 같은 규칙으로 "무엇을 왜 바꿨는지 한 줄"입니다. squash merge 뒤 `main`에는 이 제목이 커밋 메시지로 남습니다.
- 승인은 필수가 아닙니다. 작성자가 직접 **Squash and merge**를 누릅니다. 다른 사람이 보면 좋을 변경은 PR 본문에 그 사람을 `@`로 언급합니다.
- 같은 파일을 두 사람이 동시에 고치고 있다면 먼저 올라간 PR이 우선입니다. 나중 사람은 그 PR이 머지된 뒤 자기 브랜치에서 `git pull --rebase origin main`을 실행해 충돌을 풀고 다시 push합니다.
- 작업 단위마다 작게 자주 커밋합니다. 여러 사람의 작업을 한 사람이 모아서 올리지 않습니다.
- 두 사람이 함께 쓴 문서는 커밋 메시지 마지막 줄에 `Co-authored-by: 이름 <이메일>`을 넣으면 두 사람 모두의 기여로 기록됩니다. AI 도구는 공동 저자로 적지 않습니다.

## 충돌을 피하는 파일 소유 규칙

| 파일 | 규칙 |
|---|---|
| `docs/premortem/<이름>.md` | 본인만 고칩니다. 다른 사람 파일은 오타라도 건드리지 않고 본인에게 말합니다. |
| `docs/interviews/YYYY-MM-DD-<대상>.md`, `docs/meetings/YYYY-MM-DD.md` | 날짜와 대상별로 파일을 나눕니다. 한 파일에 여러 날을 이어 쓰지 않습니다. |
| `docs/PROJECT.md`, `docs/QUESTIONS.md`, `docs/PREMORTEM.md` | 공용 문서입니다. 고치면 파일 끝 Revision log에 날짜와 이유를 한 줄 추가합니다. 방향이 바뀌는 큰 수정은 PR을 올리기 전에 팀 채팅에 한 줄 알립니다. |
| `docs/specs/spec-<기능명>.md` | 기능 하나에 파일 하나입니다. 스펙을 쓴 사람이 그 기능의 담당자입니다. |

## `main` 브랜치 규칙

GitHub 저장소 설정(ruleset)으로 강제합니다. 관리자도 예외가 없습니다.

- **PR 필수:** `main`에는 PR을 통해서만 커밋이 들어갑니다. 승인 수는 요구하지 않습니다.
- **Squash merge만:** 머지 버튼은 "Squash and merge"만 켜져 있습니다. 브랜치 안의 자잘한 커밋은 PR 하나당 커밋 하나로 합쳐집니다.
- **Linear history:** merge 커밋은 거부됩니다. `git pull`을 rebase 없이 해서 merge 커밋이 생겼다면 `git pull --rebase origin main`으로 정리한 뒤 다시 push 합니다.
- **Force push 금지, 브랜치 삭제 금지:** 이미 올라간 커밋을 덮어쓸 수 없습니다. 되돌려야 하면 `git revert`로 새 커밋을 만들어 PR로 올립니다.

## 보안: 공개 레포에 올리지 않는 것

이 저장소는 누구나 볼 수 있고, 한 번 push된 내용은 force push가 막혀 있어 지울 수 없습니다. 올리기 전에 한 번 더 봅니다.

| 올리지 않는 것 | 어떻게 다루나 |
|---|---|
| API 키, 토큰, 비밀번호, `.env` | `.env`는 `.gitignore`에 있습니다. 팀이 공유할 변수 이름은 `.env.example`에 **빈 값**으로 적습니다. 키 값 자체는 팀 채팅이 아니라 1:1로 전달하거나 각자 발급합니다. |
| 인터뷰 대상의 실명, 연락처, 녹음, 녹취 원문 | `docs/interviews/raw/`와 음성 파일은 `.gitignore`에 있습니다. 올리는 기록(`.md`)에는 가명이나 "보호자 A"처럼 익명으로 적고, 가족 사정은 분석에 필요한 만큼만 남깁니다. |
| 개인 이메일 | 커밋 이메일은 GitHub noreply 주소를 씁니다(위 "처음 한 번"). 문서 본문에도 개인 이메일과 전화번호를 적지 않습니다. |
| 개인 도구 설정 | `CLAUDE.local.md`, `.claude/settings.local.json`, `.vscode/`, `.idea/`는 `.gitignore`에 있습니다. |

GitHub의 secret scanning push protection이 켜져 있어, 알려진 형식의 API 키가 들어 있는 push는 서버가 거부합니다. 거부되면 그 키는 **이미 노출된 것으로 보고 새로 발급**한 뒤, 파일에서 지우고 다시 커밋합니다. 실수로 올라간 뒤 알았다면 혼자 지우려 하지 말고 바로 팀에 알립니다. 키 재발급이 히스토리 정리보다 먼저입니다.

AI 코딩 도구(Claude Code 등)를 쓸 때는 `.env`나 키 파일을 읽히지 않도록 하고, 도구가 만든 커밋도 push 전에 `git diff --cached`로 한 번 확인합니다.

## 개발 원칙

코드가 생기면 다음 세 가지를 지킵니다.

- **스펙 먼저.** 기능을 만들기 전에 `docs/specs/spec-<기능명>.md`에 무엇을 누구를 위해 어떻게 만들지 적고, PR로 올려 팀이 확인한 뒤 개발을 시작합니다. 스펙 없이 올라온 기능 PR은 스펙 PR을 먼저 만듭니다.
- **SLC: Simple, Lovable, Complete.** 목표는 MVP가 아니라 작아도 끝까지 완성돼 쓰는 사람이 좋아하는 제품입니다. 범위를 줄여서라도 완성합니다.
- **한 기능을 끝까지.** 잘 다듬은 기능 하나가 반쯤 된 기능 다섯 개보다 낫습니다. 새 기능을 시작하기 전에 진행 중인 기능이 완성됐는지 먼저 확인합니다.

## 문서 위치

| 내용 | 위치 |
|---|---|
| 프로젝트 정의, 질문, premortem | `docs/PROJECT.md`, `docs/QUESTIONS.md`, `docs/PREMORTEM.md`, `docs/premortem/<이름>.md` |
| 기능 스펙 | `docs/specs/spec-<기능명>.md` |
| 인터뷰 가이드와 기록 | `docs/interviews/YYYY-MM-DD-<대상>.md` |
| 회의록 | `docs/meetings/YYYY-MM-DD.md` |
| 리서치, 비교, 요약 | `docs/` 바로 아래 |

문서는 한국어로 쓰고, 파일 입출력은 UTF-8을 씁니다. `.docx`나 `.hwp`가 아니라 `.md`로 저장합니다.
