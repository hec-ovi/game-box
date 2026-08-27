#!/usr/bin/env node
/**
 * A stand-in for agy, so the command engine can be tested without it installed.
 * It speaks the same surface: `--version`, the `models` listing, and a print
 * run that reads one NDJSON turn from stdin and writes NDJSON events back.
 *
 * The command runs with a scrubbed environment, so which behaviour it takes
 * comes from `--model`, which also proves the model reached the command.
 */
import { readFileSync } from 'node:fs'

const argv = process.argv.slice(2)

if (argv[0] === '--version') {
  process.stdout.write('9.9.9\n')
  process.exit(0)
}
if (argv[0] === 'models') {
  process.stdout.write('Fetching available models...\n')
  process.stdout.write('stub-fast\tStub Fast\nstub-slow\tStub Slow\n')
  process.exit(0)
}

const model = valueOf('--model') ?? ''
const schemaPath = valueOf('--json-schema')

if (model === 'crash') {
  process.stderr.write('the stub fell over\n')
  process.exit(3)
}
if (model === 'garbage') {
  process.stdout.write('this is not the JSON it promised\n')
  process.exit(0)
}
if (model === 'hang') {
  setInterval(() => {}, 1000)
} else {
  answer(await readStdin())
}

function valueOf(flag) {
  const at = argv.indexOf(flag)
  return at === -1 ? undefined : argv[at + 1]
}

function readStdin() {
  return new Promise((resolve) => {
    let text = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      text += chunk
    })
    process.stdin.on('end', () => resolve(text))
  })
}

function answer(stdin) {
  const prompt = JSON.parse(stdin.trim()).message.content
  const schema = schemaPath === undefined ? undefined : JSON.parse(readFileSync(schemaPath, 'utf8'))
  write({ event: 'init', conversation_id: 'stub-1', init: { model } })

  if (model === 'prose') {
    // no structured output at all: the answer arrives as text carrying JSON
    return done({ status: 'SUCCESS', response: `Here you go:\n\`\`\`json\n${JSON.stringify({ prompt, schema })}\n\`\`\`\n` })
  }
  if (model === 'refuses') {
    return done({ status: 'ERROR', response: '', error: 'the account has no credit' })
  }
  // the enforced answer, beside a text that carries the two fields agy adds to
  // the tool it enforces a schema through
  return done({
    status: 'SUCCESS',
    response: JSON.stringify({ prompt, schema, toolAction: 'Answering', toolSummary: 'The answer' }),
    structured_output: { prompt, schema },
  })
}

function done(result) {
  write({ event: 'result', result })
}

function write(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}
