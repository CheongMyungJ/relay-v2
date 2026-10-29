// 업무 유형 화면 (D459, D512): 기본 유형(읽기 전용), 전역 유형과 등록한 프로젝트마다의 레포 유형 목록, [새 유형](베이스 고르기),
// 유형 편집, [레포로 복사], [폴더 열기]. 전역 유형만 앱에서 고친다. 레포 유형은 읽기 전용으로 보이고 파일로 고친다(커밋과 리뷰는
// 사람이 한다, D450).
import { useEffect, useState, type ReactNode } from 'react'
import { QUESTION_MODE_LABEL, QUESTION_MODES, type QuestionMode } from '../../shared/config'
import type { CustomTypeFiles, CustomTypeList, CustomTypeView } from '../../shared/views'
import type { BuiltinWorkType, TypeSource, TypeTarget } from '../../shared/work'
import { call } from './commands'
import { customStages } from './dialogs'
import { Modal } from './Modal'

/** [단계 더하기]의 기반 단계 (D448, D512): 기본 유형의 단계 */
const BASE_STEPS: readonly (readonly [BuiltinWorkType, string, string])[] = [
  ['general', 'execute', '실행 (일반)'],
  ['bugfix', 'fix', '원인 분석과 수정 (버그 수정)'],
  ['feature', 'design', '설계와 계획 (기능 추가·변경)'],
  ['feature', 'implement', '구현 (기능 추가·변경)'],
  ['refactor', 'refactor', '계획과 리팩터링 (리팩터링)'],
  ['spec', 'spec', '설계 문답 (설계)'],
]

/** 편집 중인 단계. 절 목록은 한 줄에 하나로 고친다 */
interface StepDraft {
  id: string
  title: string
  sections: string
  lead: string
  autoApprove: boolean
  questionMode: QuestionMode | null
  stepBase: boolean
  procedure: string
}

interface TypeDraft {
  id: string
  name: string
  description: string
  requestHint: string
  branchPrefix: string
  checkMethod: boolean
  target: TypeTarget
  steps: StepDraft[]
  intake: string
  verify: string
  finish: string
  prTemplate: string
}

const EMPTY_STEP: StepDraft = {
  id: '',
  title: '',
  sections: '',
  lead: '',
  autoApprove: false,
  questionMode: null,
  stepBase: true,
  procedure: '',
}

/** 빈 유형 (D512): 확인 방법을 켠 코드 유형과 빈 단계 하나 */
const EMPTY_TYPE: TypeDraft = {
  id: '',
  name: '',
  description: '',
  requestHint: '',
  branchPrefix: '',
  checkMethod: true,
  target: 'code',
  steps: [{ ...EMPTY_STEP }],
  intake: '',
  verify: '',
  finish: '',
  prTemplate: '',
}

const lines = (s: readonly string[]) => s.join('\n')
const unlines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

function fromFiles(f: CustomTypeFiles): TypeDraft {
  return {
    id: f.def.id,
    name: f.def.name,
    description: f.def.description,
    requestHint: f.def.request_hint ?? '',
    branchPrefix: f.def.branch_prefix ?? '',
    checkMethod: f.def.check_method ?? true,
    target: f.def.target ?? 'code',
    steps: f.def.steps.map((s) => ({
      id: s.id,
      title: s.title,
      sections: lines(s.sections),
      lead: lines(s.lead ?? []),
      autoApprove: s.auto_approve,
      questionMode: s.question_mode ?? null,
      stepBase: s.step_base !== false,
      procedure: f.procedures[s.id] ?? '',
    })),
    intake: f.intake,
    verify: f.verify,
    finish: f.finish,
    prTemplate: f.prTemplate,
  }
}

function toFiles(d: TypeDraft): CustomTypeFiles {
  return {
    def: {
      id: d.id.trim(),
      name: d.name.trim(),
      description: d.description.trim(),
      request_hint: d.requestHint.trim(),
      branch_prefix: d.branchPrefix.trim(),
      check_method: d.checkMethod,
      target: d.target,
      steps: d.steps.map((s) => ({
        id: s.id.trim(),
        title: s.title.trim(),
        sections: unlines(s.sections),
        lead: unlines(s.lead),
        auto_approve: s.autoApprove,
        question_mode: s.questionMode,
        step_base: s.stepBase,
      })),
    },
    procedures: Object.fromEntries(d.steps.map((s) => [s.id.trim(), s.procedure])),
    intake: d.intake,
    verify: d.verify,
    finish: d.finish,
    prTemplate: d.prTemplate,
  }
}

/** [새 유형]의 베이스 (D512): 빈 유형이거나 고를 수 있는 유형 하나 */
type Base = { source: TypeSource; projectId: string | null; id: string } | null

const baseKey = (b: Base) => (b ? `${b.source}:${b.projectId ?? ''}:${b.id}` : '')

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

/** 업무 유형 화면 (D459, D512) */
export function CustomTypesDialog({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<CustomTypeList | null>(null)
  const [editing, setEditing] = useState<{ draft: TypeDraft; previousId: string | null } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [copyTo, setCopyTo] = useState<Record<string, string>>({})
  const [base, setBase] = useState<Base>(null)

  const reload = () => {
    void window.relay.customTypeList().then(setList)
  }
  useEffect(reload, [])

  const open = async (source: TypeSource, projectId: string | null, id: string | null) => {
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
  /** 고른 베이스로 새 유형을 연다 (D512). id는 비워 사람이 정한다 */
  const create = async (from: Base) => {
    setError(null)
    if (!from) {
      setEditing({ draft: { ...EMPTY_TYPE, steps: [{ ...EMPTY_STEP }] }, previousId: null })
      return
    }
    const files = await window.relay.typeBase(from.source, from.projectId, from.id)
    if (!files) {
      setError(`유형 ${from.id}을 읽을 수 없어 베이스로 쓰지 못합니다`)
      return
    }
    setEditing({ draft: { ...fromFiles(files), id: '' }, previousId: null })
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
        onSaved={(w) => {
          setEditing(null)
          setWarnings(w)
          reload()
        }}
      />
    )
  }

  // 베이스로 고를 수 있는 유형: 기본 유형, 전역 유형, 프로젝트마다의 레포 유형 (깨진 것은 뺀다)
  const ok = (t: CustomTypeView) => t.errors.length === 0
  const bases: { base: Base; label: string }[] = list
    ? [
        ...list.builtin.filter(ok).map((t) => ({
          base: { source: 'builtin' as const, projectId: null, id: t.id },
          label: `${t.name} (기본 유형)`,
        })),
        ...list.global.filter(ok).map((t) => ({
          base: { source: 'global' as const, projectId: null, id: t.id },
          label: `${t.name} (전역 유형 ${t.id})`,
        })),
        ...list.projects.flatMap((p) =>
          p.types
            .filter((t) => t.source === 'repo' && ok(t))
            .map((t) => ({
              base: { source: 'repo' as const, projectId: p.projectId, id: t.id },
              label: `${t.name} (${p.projectName}의 레포 유형 ${t.id})`,
            })),
        ),
      ]
    : []

  return (
    <Modal title="업무 유형" onClose={onClose}>
      <div className="dim">
        유형은 의도 정리 → 단계들로 진행하고, 마지막 단계가 독립 리뷰를 받아 Work를 마무리합니다.
        기본 유형도 같은 형식이라 새 유형의 베이스로 고를 수 있습니다. Work는 만들 때의 유형을
        복사해 끝까지 그대로 씁니다. 같은 id가 레포에도 있으면 레포 것을 씁니다.
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
      {warnings.length ? (
        <div className="notice" aria-label="산출물 참조 경고">
          저장했습니다. 다음 글이 이 유형에 없는 산출물을 가리킵니다. 단계 id나 글을 맞추세요:
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}
      <h3>기본 유형</h3>
      <div className="dim">앱에 든 유형입니다. 고칠 수 없고, 새 유형의 베이스로 고릅니다.</div>
      {list === null ? (
        <div className="dim">읽는 중…</div>
      ) : (
        <ul className="custom-types">
          {list.builtin.map((t) => (
            <TypeRow key={t.id} t={t}>
              {t.errors.length ? null : (
                <button
                  onClick={() => void create({ source: 'builtin', projectId: null, id: t.id })}
                >
                  이 유형으로 새 유형
                </button>
              )}
            </TypeRow>
          ))}
        </ul>
      )}
      <h3>전역 유형</h3>
      {list === null ? (
        <div className="dim">읽는 중…</div>
      ) : list.global.length ? (
        <ul className="custom-types">
          {list.global.map((t) => (
            <TypeRow key={t.id} t={t}>
              {t.errors.length ? null : <button onClick={() => void edit(t.id)}>고치기</button>}
              {t.errors.length ? null : (
                <button
                  onClick={() => void create({ source: 'global', projectId: null, id: t.id })}
                >
                  이 유형으로 새 유형
                </button>
              )}
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
        <label className="field">
          베이스
          <select
            aria-label="새 유형의 베이스"
            value={baseKey(base)}
            onChange={(e) =>
              setBase(bases.find((b) => baseKey(b.base) === e.target.value)?.base ?? null)
            }
          >
            <option value="">빈 유형</option>
            {bases.map((b) => (
              <option key={baseKey(b.base)} value={baseKey(b.base)}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={() => void create(base)}>
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
                    <>
                      {t.errors.length ? null : (
                        <button
                          onClick={() =>
                            void create({ source: 'repo', projectId: p.projectId, id: t.id })
                          }
                        >
                          이 유형으로 새 유형
                        </button>
                      )}
                      <button onClick={() => void open('repo', p.projectId, t.id)}>
                        폴더 열기
                      </button>
                    </>
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

/**
 * 유형 편집 (D459, D512): 실행 순서로 놓는다. 기본 정보와 유형 설정 → 의도 정리 지시 → 단계(더하기, 빼기, 순서, id, 이름, 절,
 * [요약]의 절, 자동 승인, 질문 방식, 공통 바탕, 절차) → 독립 리뷰 관점 → 마무리(판정 규칙, PR 템플릿)
 */
function TypeEditor({
  initial,
  previousId,
  onClose,
  onSaved,
}: {
  initial: TypeDraft
  previousId: string | null
  onClose: () => void
  onSaved: (warnings: string[]) => void
}) {
  const [d, setD] = useState<TypeDraft>(initial)
  const [start, setStart] = useState('')
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
  /** 기반 단계를 고르면 그 단계의 절차·절·[요약]의 절·질문 방식·공통 바탕을 채운다. 유형 단위 칸은 그대로다 (D512) */
  const addStep = async () => {
    setError(null)
    let step: StepDraft = { ...EMPTY_STEP }
    const picked = BASE_STEPS.find(([type, id]) => `${type}:${id}` === start)
    if (picked) {
      const r = await call(() => window.relay.baseStep(picked[0], picked[1]))
      if (r === null) {
        setError(`기반 단계 ${picked[2]}를 읽을 수 없습니다`)
        return
      }
      if ('ok' in r) {
        setError(r.error)
        return
      }
      step = {
        id: r.step.id,
        title: r.step.title,
        sections: lines(r.step.sections),
        lead: lines(r.step.lead ?? []),
        autoApprove: false,
        questionMode: r.step.question_mode ?? null,
        stepBase: r.step.step_base !== false,
        procedure: r.procedure,
      }
    }
    // 기다리는 동안 고친 글을 덮지 않게 지금 값에 더한다
    setD((cur) => ({ ...cur, steps: [...cur.steps, step] }))
  }
  const save = async () => {
    setBusy(true)
    setError(null)
    const r = await call(() => window.relay.saveCustomType(toFiles(d), previousId))
    setBusy(false)
    if (r.ok) onSaved('warnings' in r && r.warnings ? r.warnings : [])
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
          <span className="dim">영어 소문자, 숫자, -만 씁니다</span>
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
      <div className="row">
        <label className="field grow">
          요청 입력 안내 (새 Work 대화상자, 비우면 기본 문구)
          <input
            aria-label="요청 입력 안내"
            value={d.requestHint}
            onChange={(e) => setD({ ...d, requestHint: e.target.value })}
          />
        </label>
        <label className="field">
          브랜치 접두사 (작업 브랜치 규칙의 {'{type}'}, 비우면 id)
          <input
            aria-label="브랜치 접두사"
            value={d.branchPrefix}
            onChange={(e) => setD({ ...d, branchPrefix: e.target.value })}
          />
        </label>
      </div>
      <h3>유형 설정</h3>
      <div className="row">
        <label className="toggle">
          <input
            type="checkbox"
            aria-label="완료조건 확인 방법"
            checked={d.checkMethod}
            onChange={(e) => setD({ ...d, checkMethod: e.target.checked })}
          />
          완료조건마다 확인 방법을 적게 함 (마무리가 그 방법으로 판정하고, `확인: 사람`은 묻습니다)
        </label>
        <label className="field">
          대상
          <select
            aria-label="대상"
            value={d.target}
            onChange={(e) => setD({ ...d, target: e.target.value as TypeTarget })}
          >
            <option value="code">코드</option>
            <option value="document">문서 (설계 유형처럼 문서를 리뷰하고 판정)</option>
          </select>
        </label>
      </div>
      <label className="field">
        의도 정리에 더할 지시 (선택, intake.md: 유형 전체에 하나)
        <textarea
          aria-label="intake 지시"
          rows={4}
          value={d.intake}
          onChange={(e) => setD({ ...d, intake: e.target.value })}
        />
      </label>
      <h3>단계</h3>
      <div className="dim">
        공통 바탕을 켠 단계에는 앱이 공통 규칙(입력 읽기, 범위 밖 문제, intent와 어긋날 때, 테스트,
        커밋, 설계 문서)을 앞에 붙이고, 모든 단계에 질문·handoff·종료 절차를 뒤에 붙입니다. 기본
        유형의 단계는 절차가 공통 규칙을 스스로 담아 공통 바탕이 꺼져 있습니다. 마지막 단계에는
        마무리 절차도 붙습니다.
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
            <label className="field">
              질문 방식
              <select
                aria-label={`단계 ${i + 1} 질문 방식`}
                value={s.questionMode ?? ''}
                onChange={(e) =>
                  setStep(i, {
                    questionMode: QUESTION_MODES.find((m) => m === e.target.value) ?? null,
                  })
                }
              >
                <option value="">없음 (절차대로 묻기)</option>
                {QUESTION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {QUESTION_MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <label className="toggle">
              <input
                type="checkbox"
                aria-label={`단계 ${i + 1} 자동 승인`}
                checked={s.autoApprove}
                onChange={(e) => setStep(i, { autoApprove: e.target.checked })}
              />
              자동 승인 (기본값. Work의 마지막 단계면 늘 수동)
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                aria-label={`단계 ${i + 1} 공통 바탕`}
                checked={s.stepBase}
                onChange={(e) => setStep(i, { stepBase: e.target.checked })}
              />
              공통 바탕 붙이기
            </label>
          </div>
          <div className="row">
            <label className="field grow">
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
            <label className="field grow">
              승인 화면 [요약]에 보일 절 (한 줄에 하나. 비우면 모든 절)
              <textarea
                aria-label={`단계 ${i + 1} 요약 절`}
                rows={3}
                value={s.lead}
                onChange={(e) => setStep(i, { lead: e.target.value })}
              />
            </label>
          </div>
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
          더할 단계의 기반
          <select aria-label="기반 단계" value={start} onChange={(e) => setStart(e.target.value)}>
            <option value="">빈 절차</option>
            {BASE_STEPS.map(([type, id, label]) => (
              <option key={`${type}:${id}`} value={`${type}:${id}`}>
                {label}의 절차와 산출물
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void addStep()}>
          단계 더하기
        </button>
      </div>
      <label className="field">
        독립 리뷰에 더할 관점 (선택, verify.md: 유형 전체에 하나)
        <textarea
          aria-label="리뷰 관점"
          rows={4}
          value={d.verify}
          onChange={(e) => setD({ ...d, verify: e.target.value })}
        />
      </label>
      <h3>마무리</h3>
      <label className="field">
        마무리 판정 규칙 (선택, finish.md: 마지막 단계의 마무리 규칙에 더함)
        <textarea
          aria-label="마무리 판정 규칙"
          rows={4}
          value={d.finish}
          onChange={(e) => setD({ ...d, finish: e.target.value })}
        />
      </label>
      <label className="field">
        PR 템플릿 (선택, pr-template.md: 비우면 일반 템플릿 요약 / 주요 결정 / 변경 / 테스트)
        <textarea
          aria-label="PR 템플릿"
          rows={4}
          value={d.prTemplate}
          onChange={(e) => setD({ ...d, prTemplate: e.target.value })}
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
