import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const BIN = resolve(import.meta.dirname, '../dist/index.js');
const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')) as { version: string };

function run(args: string[]): { stdout: string; stderr: string; code: number } 
{
    try 
    {
        const stdout = execFileSync('node', [BIN, ...args], { encoding: 'utf8' });
        return { stdout, stderr: '', code: 0 };
    }
    catch (err) 
    {
        const e = err as { stdout?: string; stderr?: string; status?: number };
        return {
            stdout: e.stdout ?? '',
            stderr: e.stderr ?? '',
            code: e.status ?? 1,
        };
    }
}

describe('CLI flags', () => 
{
    it('--help exits 0 and prints Usage:', () => 
    {
        const { code, stdout } = run(['--help']);
        expect(code).toBe(0);
        expect(stdout).toContain('Usage:');
    });

    it('--help output includes the j shortcut', () => 
    {
        const { stdout } = run(['--help']);
        expect(stdout).toContain('j   Jump to date');
    });

    it('-h is an alias for --help', () => 
    {
        const { code, stdout } = run(['-h']);
        expect(code).toBe(0);
        expect(stdout).toContain('Usage:');
    });

    it('--version exits 0 and prints the version from package.json', () => 
    {
        const { code, stdout } = run(['--version']);
        expect(code).toBe(0);
        expect(stdout).toContain(pkg.version);
    });

    it('-v is an alias for --version', () => 
    {
        const { code, stdout } = run(['-v']);
        expect(code).toBe(0);
        expect(stdout).toContain(pkg.version);
    });
});

describe('export subcommand validation', () => 
{
    it('export without --channel exits 1 and prints usage hint', () => 
    {
        const { code, stderr } = run(['export', '--format', 'json']);
        expect(code).toBe(1);
        expect(stderr).toContain('--channel');
    });

    it('export without --format exits 1 and prints usage hint', () => 
    {
        const { code, stderr } = run(['export', '--channel', 'general']);
        expect(code).toBe(1);
        expect(stderr).toContain('--format');
    });

    it('export with invalid --format exits 1', () => 
    {
        const { code, stderr } = run(['export', '--channel', 'general', '--format', 'pdf']);
        expect(code).toBe(1);
        expect(stderr).toContain('--format');
    });
});

describe('thread subcommand validation', () => 
{
    it('thread with non-parseable URL exits 1 and prints expected format', () => 
    {
        const { code, stderr } = run(['thread', 'not-a-url', '--format', 'json']);
        expect(code).toBe(1);
        expect(stderr).toContain('Expected:');
        expect(stderr).toContain('slack.com/archives');
    });

    it('thread without --format exits 1', () => 
    {
        const { code, stderr } = run(['thread', 'https://acme.slack.com/archives/C123/p1234567890000000']);
        expect(code).toBe(1);
        expect(stderr).toContain('--format');
    });
});
