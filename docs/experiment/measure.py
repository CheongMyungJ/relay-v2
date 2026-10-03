#!/usr/bin/env python3
"""Observe only the supplied run and its exact matched session logs. No model calls."""
import argparse
import collections
import datetime as dt
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('run', type=Path)
a = p.parse_args()
run = a.run.resolve()
events = [json.loads(s) for s in (run / 'controller.jsonl').read_text().splitlines()]
commands = [e for e in events if e.get('event') == 'command']
answers = [e for e in commands if e['command']['op'] == 'answer']
usage = json.loads((run / 'codex-usage.json').read_text())
workfiles = sorted((run / 'relay-home/projects').glob('*/works/*/work.json'))
works = [json.loads(f.read_text()) for f in workfiles]

def instant(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))

def seconds(start, end):
    return (instant(end) - instant(start)).total_seconds() if start and end else None

task_intervals = []
for file in workfiles:
    lifecycle = [json.loads(s) for s in (file.parent / 'events.jsonl').read_text().splitlines()]
    for task in json.loads(file.read_text())['tasks']:
        started = next((e['ts'] for e in lifecycle if e.get('task_id') == task['id']
                        and e['type'] == 'task.first_hook'), None)
        ready = [e['ts'] for e in lifecycle if e.get('task_id') == task['id']
                 and e['type'] == 'task.awaiting_approval']
        task_intervals.append({'task': task['id'], 'hook_to_approval_ready_seconds':
                               seconds(started, ready[-1] if ready else None)})

sessions = []
for item in usage['sessions']:
    counts = collections.Counter()
    if item.get('source'):
        for line in Path(item['source']).read_text().splitlines():
            e = json.loads(line)
            payload = e.get('payload', {})
            if e.get('type') == 'response_item' and payload.get('type') in ('function_call', 'custom_tool_call'):
                counts[payload.get('name', 'unknown')] += 1
    sessions.append({**item, 'tool_calls_by_name': dict(counts)})
fields = ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens']
totals = {k: sum(s['usage'].get(k, 0) for s in sessions) for k in fields} if usage['complete'] else None
reviews = []
for approved in commands:
    c = approved['command']
    if c['op'] != 'approve':
        continue
    matching = [e for e in commands if e['command']['op'] == 'review'
                and e['command'].get('work') == c.get('work')
                and e['command'].get('task') == c.get('task') and e['at'] < approved['at']]
    if matching:
        reviews.append({'task': c['task'], 'operator_seconds_after_review_command':
                        seconds(matching[-1]['at'], approved['at'])})
out = {
    'run': str(run), 'mode': next(e['mode'] for e in events if e.get('event') == 'start'),
    'works': [{'id': w['work_id'], 'status': w['status'],
               'elapsed_seconds': seconds(w.get('created_at'), w.get('completed_at')),
               'tasks': [{'id': t['id'], 'node': t['node'], 'status': t['status'],
                          'bounces': t.get('bounce_count'), 'session_id': t.get('session', {}).get('id')}
                         for t in w['tasks']]} for w in works],
    'answer_rounds': len(answers),
    'answered_question_fields': sum(len(e['command'].get('answers') or {}) for e in answers),
    'answer_characters': sum(len(s) for e in answers for values in (e['command'].get('answers') or {}).values() for s in values),
    'approval_actions': sum(e['command']['op'] == 'approve' for e in commands),
    'review_actions': sum(e['command']['op'] == 'review' for e in commands),
    'operator_review_intervals': reviews,
    'task_intervals_including_answer_wait': task_intervals,
    'timeout': any(e.get('event') == 'timeout' for e in events),
    'sessions': sessions, 'tokens': totals, 'dollars': None,
    'measurement_limits': 'Tool counts are top-level Codex tool calls, not a classification of wasted exploration. Wall time includes operator waits and trust. Operator is the experiment agent, not a timed human UI participant. Token counters are cumulative per session; cached input is reported separately. No dollar estimate.'
}
(run / 'measurement.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(out, ensure_ascii=False, indent=2))
