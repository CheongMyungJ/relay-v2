// 업무 유형 화면 (D459): 전역 유형과 등록한 프로젝트마다의 레포 유형 목록, [새 유형], 유형 편집, [레포로 복사], [폴더 열기].
// 전역 유형만 앱에서 고친다. 레포 유형은 읽기 전용으로 보이고 파일로 고친다(커밋과 리뷰는 사람이 한다, D450).
import { useEffect, useState, type ReactNode } from 'react'
import type { SkillName } from '../../shared/config'
import type { CustomTypeFiles, CustomTypeList, CustomTypeView } from '../../shared/views'
import type { CustomTypeSource } from '../../shared/work'
import { call } from './commands'
import { Modal, customStages } from './dialogs'

/** [새 유형]과 [단계 더하기]의 시작점으로 쓸 수 있는 기존 단계 (D448) */
const STARTING_POINTS: readonly (readonly [SkillName, string])[] = [
  ['execute', '실행 (일반)'],
  ['fix', '원인 분석과 수정 (버그 수정)'],
  ['design', '설계와 계획 (기능 추가·변경)'],
  ['implement', '구현 (기능 추가·변경)'],
  ['refactor', '계획과 리팩터링 (리팩터링)'],
  ['spec', '설계 문답 (설계)'],
]

/** 편집 중인 단계. 절 목록은 한 줄에 하나로 고친다 */
interface StepDraft {
  id: string
  title: string
  sections: string
  autoApprove: boolean
  procedure: string
}

interface TypeDraft {
  id: string
  name: string
  description: string
  steps: StepDraft[]
  intake: string
  verify: string
}

const EMPTY_STEP: StepDraft = {
  id: '',
  title: '',
  sections: '',
  autoApprove: false,
  procedure: '',
}

function fromFiles(f: CustomTypeFiles): TypeDraft {
  return {
    id: f.def.id,
    name: f.def.name,
    description: f.def.description,
    steps: f.def.steps.map((s) => ({
      id: s.id,
      title: s.title,
      sections: s.sections.join('\n'),
      autoApprove: s.auto_approve,
      procedure: f.procedures[s.id] ?? '',
    })),
    intake: f.intake,
    verify: f.verify,
  }
}

function toFiles(d: TypeDraft): CustomTypeFiles {
  return {
    def: {
      id: d.id.trim(),
      name: d.name.trim(),
      description: d.description.trim(),
      steps: d.steps.map((s) => ({
        id: s.id.trim(),
        title: s.title.trim(),
        sections: s.sections
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),
        auto_approve: s.autoApprove,
      })),
    },
    procedures: Object.fromEntries(d.steps.map((s) => [s.id.trim(), s.procedure])),
    intake: d.intake,
    verify: d.verify,
  }
}

/** 유형 한 줄: 이름, id, 단계, 형식 오류 */
function TypeRow({ t, children }: { t: CustomTypeView; children?: ReactNode }) {
  return (
    <li className="custom-type-row" aria-label={`유형 ${t.id}`}>
      <div>
        <strong>{t.name}</strong> <code className="dim">{t.id}</code>
        {t.shadowed ? (
          <span className="dim"> · 이 프로젝트에서는 같은 id의 레포 유형이 쓰임</span>
        ) : null}
      </div>
      {t.description ? <div className="dim">{t.description}</div> : null}
      {t.errors.length ? (
        <ul className="error">
          {t.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : (
        <div className="dim">단계: {customStages(t.steps)}</div>
      )}
      {children ? <div className="row">{children}</div> : null}
    </li>
  )
}

/** 업무 유형 화면 (D459) */
export function CustomTypesDialog({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<CustomTypeList | null>(null)
  const [editing, setEditing] = useState<{ draft: TypeDraft; previousId: string | null } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copyTo, setCopyTo] = useState<Record<string, string>>({})

  const reload = () => {
    void window.relay.customTypeList().then(setList)
  }
  useEffect(reload, [])

  const open = async (source: CustomTypeSource, projectId: string | null, id: string | null) => {
    const r = await call(() => window.relay.openCustomTypeFolder(source, projectId, id))
    if (!r.ok) setError(r.error)
  }
  const edit = async (id: string) => {
    setError(null)
    const files = await window.relay.customTypeFiles('global', null, id)
    if (!files) {
      setError(`유형 ${id}의 type.json을 읽을 수 없습니다. [폴더 열기]로 파일을 고치세요`)
      return
    }
    setEditing({ draft: fromFiles(files), previousId: id })
  }
  // [지우기]는 한 번 더 눌러야 지운다: 사람이 쓴 절차가 모두 사라지고 되돌릴 수 없다
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const remove = async (id: string) => {
    setConfirmDelete(null)
    const r = await call(() => window.relay.deleteCustomType(id))
    if (!r.ok) setError(r.error)
    reload()
  }
  const copy = async (id: string) => {
    const projectId = copyTo[id] ?? list?.projects[0]?.projectId
    if (!projectId) return
    const r = await call(() => window.relay.copyCustomTypeToRepo(id, projectId))
    if (!r.ok) setError(r.error)
    else
      setNotice(
        `레포에 복사했습니다: ${'path' in r && r.path ? r.path : id}. 커밋해야 팀이 같은 유형을 씁니다.`,
      )
    reload()
  }

  if (editing) {
    return (
      <TypeEditor
        initial={editing.draft}
        previousId={editing.previousId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          reload()
        }}
      />
    )
  }

  return (
    <Modal title="업무 유형" onClose={onClose}>
      <div className="dim">
        커스텀 유형은 의도 정리 → 직접 쓴 단계들 → 리뷰와 검증으로 진행합니다. Work는 만들 때의
        유형을 복사해 끝까지 그대로 씁니다. 같은 id가 레포에도 있으면 레포 것을 씁니다.
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <h3>전역 유형</h3>
      {list === null ? (
        <div className="dim">읽는 중…</div>
      ) : list.global.length ? (
        <ul className="custom-types">
          {list.global.map((t) => (
            <TypeRow key={t.id} t={t}>
              {t.errors.length ? null : <button onClick={() => void edit(t.id)}>고치기</button>}
              <button onClick={() => void open('global', null, t.id)}>폴더 열기</button>
              {list.projects.length && !t.errors.length ? (
                <>
                  <select
                    aria-label={`${t.id} 복사할 프로젝트`}
                    value={copyTo[t.id] ?? list.projects[0]?.projectId ?? ''}
                    onChange={(e) => setCopyTo({ ...copyTo, [t.id]: e.target.value })}
                  >
                    {list.projects.map((p) => (
                      <option key={p.projectId} value={p.projectId}>
                        {p.projectName}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => void copy(t.id)}>레포로 복사</button>
                </>
              ) : null}
              {confirmDelete === t.id ? (
                <>
                  <span className="error">폴더째 지우고 되돌릴 수 없습니다.</span>
                  <button className="danger" onClick={() => void remove(t.id)}>
                    정말 지우기
                  </button>
                  <button onClick={() => setConfirmDelete(null)}>그대로 두기</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(t.id)}>지우기</button>
              )}
            </TypeRow>
          ))}
        </ul>
      ) : (
        <div className="dim">아직 없습니다.</div>
      )}
      <div className="row">
        <button
          className="primary"
          onClick={() =>
            setEditing({
              draft: {
                id: '',
                name: '',
                description: '',
                steps: [{ ...EMPTY_STEP }],
                intake: '',
                verify: '',
              },
              previousId: null,
            })
          }
        >
          새 유형
        </button>
        <button onClick={() => void open('global', null, null)}>전역 유형 폴더 열기</button>
      </div>
      {list?.projects.map((p) => (
        <section key={p.projectId}>
          <h3>레포 유형 · {p.projectName}</h3>
          <div className="dim">
            레포의 <code>.relay/types/</code>에 있는 유형입니다. 파일로 고치고 커밋합니다.
          </div>
          {p.types.length ? (
            <ul className="custom-types">
              {p.types.map((t) => (
                <TypeRow key={`${t.source}:${t.id}`} t={t}>
                  {t.source === 'repo' ? (
                    <button onClick={() => void open('repo', p.projectId, t.id)}>폴더 열기</button>
                  ) : null}
                </TypeRow>
              ))}
            </ul>
          ) : (
            <div className="dim">없음</div>
          )}
        </section>
      ))}
      <div className="buttons">
        <button onClick={onClose}>닫기</button>
      </div>
    </Modal>
  )
}

/** 유형 편집 (D459): 이름, 설명, 단계(더하기, 빼기, 순서, id, 이름, 절, 자동 승인, 절차), intake.md, verify.md */
function TypeEditor({
  initial,
  previousId,
  onClose,
  onSaved,
}: {
  initial: TypeDraft
  previousId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [d, setD] = useState<TypeDraft>(initial)
  const [start, setStart] = useState<SkillName | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setStep = (i: number, patch: Partial<StepDraft>) =>
    setD({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const move = (i: number, by: number) => {
    const j = i + by
    if (j < 0 || j >= d.steps.length) return
    const steps = [...d.steps]
    const [s] = steps.splice(i, 1)
    if (s) steps.splice(j, 0, s)
    setD({ ...d, steps })
  }
  const addStep = async () => {
    setError(null)
    let procedure = ''
    if (start) {
      const r = await call(() => window.relay.skillProcedure(start))
      if (typeof r !== 'string') {
        setError(r.error)
        return
      }
      procedure = r
    }
    // 기다리는 동안 고친 글을 덮지 않게 지금 값에 더한다
    setD((cur) => ({ ...cur, steps: [...cur.steps, { ...EMPTY_STEP, procedure }] }))
  }
  const save = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.saveCustomType(toFiles(d), previousId))
    setBusy(false)
    if (r.ok) onSaved()
    else setError(r.error)
  }

  return (
    <Modal title={previousId ? `유형 고치기 · ${previousId}` : '새 유형'} onClose={onClose}>
      <div className="row">
        <label className="field">
          id (폴더 이름)
          <input
            aria-label="유형 id"
            value={d.id}
            placeholder="survey-apply"
            onChange={(e) => setD({ ...d, id: e.target.value })}
          />
          <span className="dim">
            영어 소문자, 숫자, -만 씁니다. 작업 브랜치 규칙의 {'{type}'}이 됩니다
          </span>
        </label>
        <label className="field grow">
          이름
          <input
            aria-label="유형 이름"
            value={d.name}
            placeholder="조사 후 적용"
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        설명 (의도 정리가 요청과 맞는지 볼 때 씁니다)
        <input
          aria-label="유형 설명"
          value={d.description}
          placeholder="먼저 바꿀 곳을 조사해 정리하고, 그 결과대로 적용하는 일"
          onChange={(e) => setD({ ...d, description: e.target.value })}
        />
      </label>
      <h3>단계</h3>
      <div className="dim">
        단계마다 앱이 공통 규칙(입력 읽기, 범위 밖 문제, intent와 어긋날 때, 테스트, 완료조건 자체
        확인, 커밋, 설계 문서)을 앞에, 질문·handoff·종료 절차를 뒤에 붙입니다. 절차에는 이 단계에서
        할 일만 적습니다.
      </div>
      {d.steps.map((s, i) => (
        <fieldset key={i} className="custom-step" aria-label={`단계 ${i + 1}`}>
          <legend>
            단계 {i + 1}
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>
              위로
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === d.steps.length - 1}>
              아래로
            </button>
            <button
              type="button"
              onClick={() => setD({ ...d, steps: d.steps.filter((_, j) => j !== i) })}
              disabled={d.steps.length === 1}
            >
              빼기
            </button>
          </legend>
          <div className="row">
            <label className="field">
              단계 id
              <input
                aria-label={`단계 ${i + 1} id`}
                value={s.id}
                placeholder="survey"
                onChange={(e) => setStep(i, { id: e.target.value })}
              />
            </label>
            <label className="field grow">
              단계 이름
              <input
                aria-label={`단계 ${i + 1} 이름`}
                value={s.title}
                placeholder="조사"
                onChange={(e) => setStep(i, { title: e.target.value })}
              />
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                aria-label={`단계 ${i + 1} 자동 승인`}
                checked={s.autoApprove}
                onChange={(e) => setStep(i, { autoApprove: e.target.checked })}
              />
              자동 승인 (기본값)
            </label>
          </div>
          <label className="field">
            <span>
              산출물 <code>{s.id || '<단계 id>'}.md</code>의 절 (한 줄에 하나. 비우면 "한 일",
              "완료조건별 자체 확인")
            </span>
            <textarea
              aria-label={`단계 ${i + 1} 절`}
              rows={3}
              value={s.sections}
              onChange={(e) => setStep(i, { sections: e.target.value })}
            />
          </label>
          <label className="field">
            절차
            <textarea
              aria-label={`단계 ${i + 1} 절차`}
              rows={8}
              value={s.procedure}
              placeholder="이 단계에서 에이전트가 할 일을 적습니다"
              onChange={(e) => setStep(i, { procedure: e.target.value })}
            />
          </label>
        </fieldset>
      ))}
      <div className="row">
        <label className="field">
          더할 단계의 시작점
          <select
            aria-label="시작점"
            value={start}
            onChange={(e) => setStart(e.target.value as SkillName | '')}
          >
            <option value="">빈 절차</option>
            {STARTING_POINTS.map(([skill, label]) => (
              <option key={skill} value={skill}>
                {label}의 절차 복사
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void addStep()}>
          단계 더하기
        </button>
      </div>
      <label className="field">
        의도 정리에 더할 지시 (선택, intake.md)
        <textarea
          aria-label="intake 지시"
          rows={3}
          value={d.intake}
          onChange={(e) => setD({ ...d, intake: e.target.value })}
        />
      </label>
      <label className="field">
        리뷰와 검증에 더할 리뷰 관점 (선택, verify.md)
        <textarea
          aria-label="리뷰 관점"
          rows={3}
          value={d.verify}
          onChange={(e) => setD({ ...d, verify: e.target.value })}
        />
      </label>
      {error ? <div className="error">{error}</div> : null}
      <div className="buttons">
        <button onClick={onClose}>취소</button>
        <button className="primary" disabled={busy} onClick={() => void save()}>
          저장
        </button>
      </div>
    </Modal>
  )
}
