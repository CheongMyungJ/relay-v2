"""event.v1.schema.json 생성기. 이벤트 타입을 추가·변경할 때 이 파일을 고치고 실행한다: python3 tools/gen_event_schema.py"""
import json
S={"type":"string"}; I={"type":"integer"}; B={"type":"boolean"}
def obj(req, **props):
    d=props.pop("_desc_",{})
    return {"type":"object","additionalProperties":False,"required":req,"properties":props,**d}
arr=lambda x:{"type":"array","items":x}
enum=lambda *v:{"enum":list(v)}
checks=arr({"$ref":"https://relay.local/schemas/work.v1.json#/$defs/checkResult"})
payloads={
 "work.created": obj(["project_id","pipeline_id","pipeline_version","branch","base_commit"],project_id=S,pipeline_id=S,pipeline_version=I,branch=S,base_commit=S),
 "work.paused": obj(["cause"],cause=enum("user","session_limit")),
 "work.resumed": obj([]),
 "work.needs_attention": obj(["reason","message"],reason=S,message=S,step_id=S),
 "work.attention_cleared": obj(["reason"],reason=S),
 "work.path_escalated": obj(["via_node"],via_node=S),
 "work.completed": obj(["delivery_mode"],delivery_mode=enum("none","push","pr")),
 "work.abandoned": obj(["at_node"],at_node={"type":["string","null"]},note=S),
 "work.reopened": obj([]),
 "work.cleaned": obj(["worktree_removed","branch_deleted"],worktree_removed=B,branch_deleted=B,uncommitted_discarded=B),
 "task.started": obj(["node_id","skill","reason","session_id","attempt_id","manifest"],node_id=S,skill=S,reason=S,session_id=S,attempt_id=S,pid={"type":["integer","null"]},process_started_at=S,manifest={"type":"string","description":"context.manifest.json 경로"},temporary=B),
 "task.resumed": obj(["session_id","attempt_id","cause"],session_id=S,attempt_id=S,pid={"type":["integer","null"]},process_started_at=S,cause=enum("app_restart","crash","handoff_missing","invalid_exit","user"),prompt=S),
 "task.session_changed": obj(["session_id","source"],session_id=S,source=enum("clear","resume","fork","compact")),
 "task.input": obj(["input_generation"],input_generation=I),
 "task.awaiting_approval": obj(["handoff_sha256","valid"],handoff_sha256=S,valid=B,status=enum("awaiting_approval","blocked"),errors=arr(S)),
 "task.handoff_invalid": obj(["errors","feedback_sent","attempt"],errors=arr(S),feedback_sent=B,attempt=I),
 "task.approved": obj(["by","next_node","candidate_id","handoff_sha256","artifact_hashes","head","intent_version","decisions","rejected"],
     by=enum("human","auto"),next_node=S,candidate_id=S,handoff_sha256=S,artifact_hashes={"type":"object","additionalProperties":S},head=S,clean=B,intent_version=I,
     merged_gate=B,forced_invalid=B,decisions=arr({"type":"object"}),rejected=arr(S),
     _desc_={"description":"decisions.md와 rejected-log는 이 payload에서 재생성한다(C2)"}),
 "task.abandoned": obj(["cause"],cause=enum("user_reroute","work_abandoned","intent_revise","user_stop","retry"),rejected=arr(S)),
 "task.interrupted": obj(["cause"],cause=enum("app_exit","app_crash","pty_exit","user_pause"),exit_code={"type":["integer","null"]}),
 "task.ended_no_handoff": obj(["exit_code"],exit_code={"type":["integer","null"]}),
 "task.rerouted": obj(["from_node","to_node","group","during_task"],from_node=S,to_node=S,group=enum("default","transition","recommended","other","suggested"),temporary=B,during_task=B,missing_requires=arr(S),reason_ref={"type":"string","description":"원인이 된 검사 로그·handoff·추천 참조"},note={"type":"string","description":"사용자가 남긴 선택 메모(필수 아님)"}),
 "approval.candidate_created": obj(["candidate_id","input_generation","handoff_sha256","head","config_fingerprint"],candidate_id=S,input_generation=I,handoff_sha256=S,head=S,clean=B,config_fingerprint=S),
 "approval.candidate_discarded": obj(["candidate_id","cause"],candidate_id=S,cause=enum("new_input","handoff_changed","artifact_changed","head_changed","config_changed","resumed","mismatch_on_approve")),
 "approval.evaluated": obj(["candidate_id","eligible","blocking"],candidate_id=S,eligible=B,blocking=arr(S),checks=checks),
 "approval.countdown_started": obj(["candidate_id","seconds"],candidate_id=S,seconds=I),
 "approval.countdown_cancelled": obj(["remaining_sec","by"],remaining_sec=I,by=enum("user","condition_changed")),
 "gate.started": obj(["node_id","gate","attempt_id"],node_id=S,gate=enum("human","check","review"),attempt_id=S,checks=arr(S)),
 "gate.passed": obj(["node_id","by"],node_id=S,checks=checks,by=enum("app","human"),role=S),
 "gate.failed": obj(["node_id","attempt_id"],node_id=S,attempt_id=S,checks=checks,suggest={"type":"string","description":"on_fail 제안 노드"}),
 "checks.discarded": obj(["attempt_id","cause"],attempt_id=S,cause=enum("rerouted","paused","abandoned","superseded")),
 "repro.locked": obj(["file","sha256","commit","fail_exit_code","locked_by_step"],file=S,sha256=S,commit=S,fail_exit_code=I,locked_by_step=S),
 "repro.lock_failed": obj(["file","cause"],file=S,cause=enum("passed_unexpectedly","not_committed","file_missing","no_test_file_command","timeout")),
 "repro.relocked": obj(["sha256","commit","by_step"],sha256=S,commit=S,by_step=S),
 "repro.released": obj([],note=S),
 "intent.approved": obj(["version","title"],version=I,title=S,size=S,delivery=enum("none","push","pr")),
 "intent.revised": obj(["from_version","to_version","title","stale_artifacts","resume_node"],from_version=I,to_version=I,title=S,stale_artifacts=arr({"type":"object"}),resume_node=S),
 "delivery.started": obj(["run_id","mode","head","remote","base"],run_id=S,mode=enum("push","pr"),head=S,remote=S,base=S),
 "delivery.succeeded": obj(["run_id","mode"],run_id=S,mode=enum("push","pr"),remote_ref=S,pr_url=S),
 "delivery.failed": obj(["run_id","mode","error"],run_id=S,mode=enum("push","pr"),error=S),
 "artifact.modified_after_approval": obj(["file"],file=S),
 "state.external_change_ignored": obj(["file"],file=S),
}
schema={
 "$schema":"https://json-schema.org/draft/2020-12/schema",
 "$id":"https://relay.local/schemas/event.v1.json",
 "title":"Lifecycle event (v1)",
 "description":"works/<work-id>/events.jsonl 한 줄. 파일에 추가(append + fsync)한 뒤 앱 내부 이벤트 버스로 발행한다. 구독자(알림, 통계, 향후 지식 추출)는 이 형식만 의존한다. 새 이벤트 추가는 호환(minor), 기존 payload 필드 삭제/의미 변경은 schema_version 증가.",
 "type":"object","additionalProperties":False,
 "required":["schema_version","seq","ts","work_id","type","payload"],
 "properties":{
  "schema_version":{"const":1},
  "seq":{"type":"integer","minimum":1,"description":"Work 안에서 단조 증가. 복구 시 중복 적용 방지"},
  "ts":{"type":"string","format":"date-time"},
  "work_id":{"type":"string","pattern":"^w-[0-9]{8}-[0-9]{3}$"},
  "step_id":{"type":"string","pattern":"^t-[0-9]{2,3}$"},
  "type":{"enum":list(payloads)},
  "payload":{"type":"object"}
 },
 "allOf":[{"if":{"properties":{"type":{"const":t}}},"then":{"properties":{"payload":{"$ref":"#/$defs/"+t.replace('.','_')}}}} for t in payloads],
 "$defs":{t.replace('.','_'):p for t,p in payloads.items()}
}
import os
json.dump(schema,open(os.path.join(os.path.dirname(__file__),'..','docs','contracts','event.v1.schema.json'),'w'),ensure_ascii=False,indent=2)
