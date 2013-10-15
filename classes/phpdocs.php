<?php


/**
 * Handles one phpdocs
 *
 * @package    local_moodlecheck
 * @copyright  2012 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class tool_behateditor_phpdocs {
    /** @var array static property storing the list of valid,
     * well known, phpdocs tags, always accepted.
     * @link http://manual.phpdoc.org/HTMLSmartyConverter/HandS/ */
    public static $validtags = array(
        'abstract', 'access', 'author', 'category', 'copyright',
        'deprecated', 'example', 'final', 'fileresource', 'global',
        'ignore', 'internal', 'license', 'link', 'method',
        'name', 'package', 'param', 'property', 'return',
        'see', 'since', 'static', 'staticvar', 'subpackage',
        'throws', 'todo', 'tutorial', 'uses', 'var', 'version');
    /** @var array static property storing the list of recommended
     * phpdoc tags to use within Moodle phpdocs.
     * @link http://docs.moodle.org/dev/Coding_style */
    public static $recommendedtags = array(
        'author', 'category', 'copyright', 'deprecated', 'license',
        'link', 'package', 'param', 'return', 'see',
        'since', 'subpackage', 'throws', 'todo', 'uses', 'var');
    /** @var array static property storing the list of phpdoc tags
     * allowed to be used inline within Moodle phpdocs. */
     public static $inlinetags = array(
         'link');
    /** @var array stores the original token for this phpdocs */
    protected $originaltoken = null;
    /** @var int stores id the original token for this phpdocs */
    protected $originaltid = null;
    /** @var string text of phpdocs with trimmed start/end tags
     * as well as * in the beginning of the lines */
    protected $trimmedtext = null;
    /** @var boolean whether the phpdocs contains text after the tokens
     * (possible in phpdocs but not recommended in Moodle) */
    protected $brokentext = false;
    /** @var string the description found in phpdocs */
    protected $description;
    /** @var array array of string where each string
     * represents found token (may be also multiline) */
    protected $tokens;

    /**
     * Constructor. Creates an object and parses it
     *
     * @param array $token corresponding token parsed from file
     * @param int $tid id of token in the file
     */
    public function __construct($token, $tid) {
        $this->originaltoken = $token;
        $this->originaltid = $tid;
        if (preg_match('|^///|', $token[1])) {
            $this->trimmedtext = substr($token[1], 3);
        } else {
            $this->trimmedtext = preg_replace(array('|^\s*/\*+|', '|\*+/\s*$|'), '', $token[1]);
            $this->trimmedtext = preg_replace('|\n[ \t]*\*|', "\n", $this->trimmedtext);
        }
        $lines = preg_split('/\n/', $this->trimmedtext);

        $this->tokens = array();
        $this->description = '';
        $istokenline = false;
        for ($i=0; $i<count($lines); $i++) {
            if (preg_match('|^\s*\@(\w+)\W|', $lines[$i])) {
                // first line of token
                $istokenline = true;
                $this->tokens[] = $lines[$i];
            } else if (strlen(trim($lines[$i])) && $istokenline) {
                // second/third line of token description
                $this->tokens[count($this->tokens)-1] .= "\n". $lines[$i];
            } else {
                // this is part of description
                if (strlen(trim($lines[$i])) && !empty($this->tokens)) {
                    // some text appeared AFTER tokens
                    $this->brokentext = true;
                }
                $this->description .= $lines[$i]."\n";
                $istokenline = false;
            }
        }
        foreach ($this->tokens as $i => $token) {
            $this->tokens[$i] = trim($token);
        }
        $this->description = trim($this->description);
    }

    /**
     * Returns all tags found in phpdocs
     *
     * Returns array of found tokens. Each token is an unparsed string that
     * may consist of multiple lines.
     * Asterisk in the beginning of the lines are trimmed out
     *
     * @param string $tag if specified only tokens matching this tag are returned
     *   in this case the token itself is excluded from string
     * @param bool $nonempty if true return only non-empty tags
     * @return array
     */
    public function get_tags($tag = null, $nonempty = false) {
        if ($tag === null) {
            return $this->tokens;
        } else {
            $rv = array();
            foreach ($this->tokens as $token) {
                if (preg_match('/^\s*\@'.$tag.'\s([^\0]*)$/', $token.' ', $matches) && (!$nonempty || strlen(trim($matches[1])))) {
                    $rv[] = trim($matches[1]);
                }
            }
            return $rv;
        }
    }

    /**
     * Returns all tags found in phpdocs
     *
     * @deprecated use get_tags()
     * @param string $tag
     * @param bool $nonempty
     * @return array
     */
    public function get_tokens($tag = null, $nonempty = false) {
        return get_tags($tag, $nonempty);
    }

    /**
     * Returns the description without tokens found in phpdocs
     *
     * @return string
     */
    public function get_description() {
        return $this->description;
    }

    /**
     * Returns true if part of the text is after any of the tokens
     *
     * @return bool
     */
    public function is_broken_description() {
        return $this->brokentext;
    }

    /**
     * Returns true if this is an inline phpdoc comment (starting with three slashes)
     *
     * @return bool
     */
    public function is_inline() {
        return preg_match('|^\s*///|', $this->originaltoken[1]);
    }

    /**
     * Returns the original token storing this phpdocs
     *
     * @return array
     */
    public function get_original_token() {
       return $this->originaltoken;
    }

    /**
     * Returns the id for original token storing this phpdocs
     *
     * @return int
     */
    public function get_original_token_id() {
       return $this->originaltid;
    }

    /**
     * Returns short description found in phpdocs if found (first line followed by empty line)
     *
     * @return string
     */
    public function get_shortdescription() {
        $lines = preg_split('/\n/', $this->description);
        if (count($lines) == 1 || (count($lines) && !strlen(trim($lines[1])))) {
            return $lines[0];
        } else {
            return false;
        }
    }

    /**
     * Returns list of parsed param tokens found in phpdocs
     *
     * Each element is array(typename, variablename, variabledescription)
     *
     * @param string $tag tag name to look for. Usually param but may be var for variables
     * @param int $splitlimit maximum number of chunks to return
     * @return array
     */
    public function get_params($tag = 'param', $splitlimit = 3) {
        $params = array();
        foreach ($this->get_tags($tag) as $token) {
            $params[] = preg_split('/\s+/', trim($token), $splitlimit); // i.e. 'type $name multi-word description'
        }
        return $params;
    }

    /**
     * Returns the line number where this phpdoc occurs in the file
     *
     * @param local_moodlecheck_file $file
     * @param string $substring if specified the line number of first occurence of $substring is returned
     * @return int
     */
    public function get_line_number(local_moodlecheck_file $file, $substring = null) {
        $line0 = $file->get_line_number($this->get_original_token_id());
        if ($substring === null) {
            return $line0;
        } else {
            $chunks = preg_split('!' . $substring . '!', $this->originaltoken[1]);
            if (count($chunks) > 1) {
                $lines = preg_split('/\n/', $chunks[0]);
                return $line0 + count($lines) - 1;
            } else {
                return $line0;
            }
        }
    }

    /**
     * Returns all the inline tags found in the phpdoc
     *
     * This method returns all the phpdocs tags found inline,
     * embed into the phpdocs contents. Only valid tags are
     * considered See {@link self::$validtags}.
     *
     * @param bool $withcurly if true, only tags properly enclosed
     *        with curly brackets are returned. Else all the inline tags are returned.
     *
     * @return array inline tags found in the phpdoc, without
     * any cleaning and including curly braces if present
     */
    public function get_inline_tags($withcurly = true) {
        $inlinetags = array();
        // Trim the non-inline phpdocs tags
        $text = preg_replace('|^\s*@?|m', '', $this->trimmedtext);
        if ($withcurly) {
            $regex = '#{@([a-z]*).*?}#';
        } else {
            $regex = '#@([a-z]*).*?#';
        }
        if (preg_match_all($regex, $text, $matches)) {
            // Filter out invalid ones, can be ignored
            foreach ($matches[1] as $tag) {
                if (in_array($tag, self::$validtags)) {
                    $inlinetags[] = $tag;
                }
            }
        }
        return $inlinetags;
    }
}
