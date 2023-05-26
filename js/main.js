window.addEventListener('load', () => {
  initDT(); // Initialize the DataTable and window.columnNames variables

  addDarkmodeWidget();

  Options.loadAndShow();

  Progress().hide();

  const repo = getRepoFromUrl();

  try {
    const token = localStorage.getItem('token');
    if (token) {
      document.getElementById('token').value = token;
    }
    toggleToken();
  } catch { }

  try {
    const branch = localStorage.getItem('branch');
    if (branch)
      document.getElementById('branch').value = branch;
  } catch { }

  if (repo) {
    document.getElementById('q').value = repo;
    fetchData();
  }
});

document.getElementById('form').addEventListener('submit', e => {
  e.preventDefault();
  fetchData();
});

function toggleToken() {
  const button = document.getElementById('collapsible');
  button.classList.toggle('active');

  const content = button.parentElement.previousElementSibling;
  content.classList.toggle('d-none');
  button.innerHTML = content.classList.contains('d-none') ? 'Show Token' : 'Hide Token';
}

function addDarkmodeWidget() {
  new Darkmode({ label: '🌓' }).showWidget();
}

let running = false;

async function fetchData(diff = false) {
  if (running) {
    running = false;
    return;
  }
  Runner.start(diff);

  const repo = document.getElementById('q').value.replaceAll(' ', '');
  const re = /[-_\w]+\/[-_.\w]+/;

  const urlRepo = getRepoFromUrl();

  if (!urlRepo || urlRepo !== repo) {
    window.history.pushState('', '', `#${repo}`);
  }

  if (re.test(repo)) {
    (async function () {
      await fetchAndShow(repo, diff);

      if (diff) {
        window.forkTable.columns([8, 9]).visible(true);
      } else {
        window.forkTable.columns([8, 9]).visible(false);
      }

      Runner.stop(diff);
    })();
  } else {
    Runner.stop(diff);
    showMsg(
      'Invalid GitHub repository! Format is &lt;username&gt;/&lt;repo&gt;',
      'danger'
    );
  }
}

function updateDT(data) {
  // Remove any alerts, if any:
  if ($('.alert')) $('.alert').remove();

  // Format dataset and redraw DataTable. Use second index for key name
  const forks = [];
  const github = 'https://github.com/';
  for (let fork of data) {
    // fork.repoLink = `<a href="${github}${fork.full_name}" target="_blank" rel="noopener noreferrer">Link</a>`;
    fork.ownerName = `<a href="${github}${fork.owner.login}" title="Open in new tab: ${fork.owner.login}" target="_blank"><img src="${fork.owner.avatar_url || 'https://avatars.githubusercontent.com/u/0?v=4'}&s=48" width="24" height="24" class="mr-2 rounded-circle" />${fork.owner ? fork.owner.login : '<strike><em>Unknown</em></strike>'}</a>`;
    fork.repoName = `<a href="${github}${fork.full_name}" title="Open in new tab: ${fork.full_name}" target="_blank">${fork.name}</a>`;
    fork.forks_count = `${(fork.forks_count >= 1) ? `<a href="${github}${fork.full_name}/forks" title="Open in new tab: ${fork.full_name}/forks" target="_blank">${fork.forks_count}</a>` : 0}`;
    fork.open_issues_count = `${(fork.open_issues_count >= 1) ? `<a href="${github}${fork.full_name}/issues" title="Open in new tab: ${fork.full_name}/issues" target="_blank">${fork.open_issues_count}</a>` : 0}`;
    forks.push(fork);
  }
  const dataSet = forks.map(fork =>
    window.columnNamesMap.map(colNM => fork[colNM[1]])
  );
  window.forkTable
    .clear()
    .rows.add(dataSet)
    .draw();
}

function initDT(diff = false) {
  // Create ordered Object with column name and mapped display name
  window.columnNamesMap = [
    // ['Link', 'repoLink'],
    ['Owner', 'ownerName'],
    ['Repo', 'repoName'],
    ['Branch', 'default_branch'],
    ['Stars', 'stargazers_count'],
    ['Forks', 'forks_count'],
    ['Open Issues', 'open_issues_count'],
    ['Size', 'size'],
    ['Last Push', 'pushed_at'],
    ['Diff Behind', 'diff_from_original'],
    ['Diff Ahead', 'diff_to_original'],
  ];

  // Sort by stars:
  const sortColName = 'Stars';
  const sortColumnIdx = window.columnNamesMap
    .map(pair => pair[0])
    .indexOf(sortColName);

  // Use first index for readable column name
  // we use moment's fromNow() if we are rendering for `pushed_at`; better solution welcome
  window.forkTable = $('#forkTable').DataTable({
    columns: window.columnNamesMap.map(colNM => {
      return {
        title: colNM[0],
        render: (data, type, _row) => {
          switch (colNM[1]) {

            case 'pushed_at':
              return type === 'display'
                ? moment(data).format('YYYY-MM-DD')
                : data;

            case 'diff_from_original':
            case 'diff_to_original':
              return type === 'display'
                ? data
                : data.substr(4, 4);

            default:
              return data;
          }
        }
      };
    }),
    columnDefs: [
      { className: 'dt-right', targets: [3, 4, 5, 6, 8, 9] }, // numbers
      { width: '120px', targets: 7 }, // date
    ],
    order: [[sortColumnIdx, 'desc']],
    createdRow: function (row, _, index) {
      $('[data-toggle=popover]', row).popover();
      if (index === 0) {
        row.classList.add('original-repo');
      }
    },
    scrollX: true,
    // paging: false,
    searchBuilder: {
      // all options at default
    }
  });

  // remove diff columns if not diffing
  if (!diff) {
    window.forkTable.columns([8, 9]).visible(false);
  }

  let table = window.forkTable;
  new $.fn.dataTable.SearchBuilder(table, {});
  table.searchBuilder.container().prependTo(table.table().container());
}

async function fetchAndShow(repo, diff = false) {
  repo = repo.replace('https://github.com/', '');
  repo = repo.replace('http://github.com/', '');
  repo = repo.replace(/\.git$/, '');

  const token = document.getElementById('token').value.replaceAll(' ', '');
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }

  const branch = document.getElementById('branch').value.replaceAll(' ', '');
  if (branch) {
    localStorage.setItem('branch', branch);
  } else {
    localStorage.removeItem('branch');
  }

  const api = Api(token);

  const data = [];
  try {
    const maxRecords = Options.getAndSave().maxRecords;

    const singleLimiter = fork => ({
      full_name: fork.full_name,
      name: fork.name,
      default_branch: fork.default_branch,
      stargazers_count: fork.stargazers_count,
      forks_count: fork.forks_count,
      open_issues_count: fork.open_issues_count,
      size: fork.size,
      pushed_at: fork.pushed_at,
      owner: {
        login: fork.owner.login,
        avatar_url: fork.owner.avatar_url
      }
    });

    const multiLimiter = data => data.map(singleLimiter);

    let originalBranch = branch ? branch : 'main';
    if (diff) {
      const originalRepo = await api.fetch(`https://api.github.com/repos/${repo}`, singleLimiter);
      originalRepo.diff_from_original = originalRepo.diff_to_original = '0';
      originalRepo.behind_by = originalRepo.ahead_by = '0';
      originalBranch = branch ? branch : originalRepo.default_branch;
      data.push(originalRepo);
    }

    let page = 1;
    while (data.length - 1 < maxRecords) {
      const url = `https://api.github.com/repos/${repo}/forks?sort=stargazers&per_page=${maxRecords}&page=${page}`;
      const someData = await api.fetch(url, multiLimiter);

      if (someData.length === 0) break;

      someData.forEach(fork => {
        fork.diff_from_original = '0';
        fork.diff_to_original = '0';
        fork.behind_by = '0';
      });

      data.push(...someData);
      if (someData.length < maxRecords) break;
      ++page;
    }

    await updateData(repo, originalBranch, data.slice(1), api, diff);
  } catch (error) {
    console.error(error);
  }

  try {
    updateDT(data);
  } catch (error) {
    const msg =
      error.toString().indexOf('Forbidden') >= 0
        ? 'Error: API Rate Limit Exceeded'
        : error;
    showMsg(`${msg}. Additional info in console`, 'danger');
    console.error(error);
  }
}

function showMsg(msg, type) {
  let alert_type = 'alert-info';

  if (type === 'danger') {
    alert_type = 'alert-danger';
  }

  document.getElementById('footer').innerHTML = '';

  document.getElementById('data-body').innerHTML = `
        <div class="alert ${alert_type} alert-dismissible fade show" role="alert">
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
            ${msg}
        </div>
    `;
}

function getRepoFromUrl() {
  const urlRepo = location.hash && location.hash.slice(1);

  return urlRepo && decodeURIComponent(urlRepo);
}

async function updateData(repo, originalBranch, forks, api, diff = false) {
  forks.forEach(fork => fork.diff_from_original = fork.diff_to_original = fork.behind_by = fork.ahead_by = '');

  let index = 1;
  const quota = Quota(api);
  const progress = Progress(forks.length);
  progress.show();

  const options = Options.getAndSave();
  const similarChecker = SimilarChecker(options);

  try {
    for (let fork of forks) {
      progress.update(index);
      if (!running) break;

      const updated = similarChecker.apply(fork);

      if (!updated && diff) {
        await fetchMore(repo, originalBranch, fork, api);
        similarChecker.cache(fork);
      }
      quota.update();
      ++index;
    }
  } finally {
    progress.hide();

    if (diff) {
      await api.refreshLimits();
    }
    quota.update();
  }
}

async function fetchMore(repo, originalBranch, fork, api) {
  return Promise.all([
    fetchMoreDir(repo, originalBranch, fork, true, api),
    fetchMoreDir(repo, originalBranch, fork, false, api)
  ]);
}

async function fetchMoreDir(repo, originalBranch, fork, fromOriginal, api) {
  const url = fromOriginal
    ? `https://api.github.com/repos/${repo}/compare/${fork.owner.login}:${fork.default_branch}...${originalBranch}`
    : `https://api.github.com/repos/${repo}/compare/${originalBranch}...${fork.owner.login}:${fork.default_branch}`;

  const limiter = data => ({
    status: data.status,
    ahead_by: data.ahead_by,
    behind_by: data.behind_by,
    total_commits: data.total_commits,
    commits: data.commits.map(c => ({
      sha: c.sha.substr(0, 6),
      commit: {
        author: {
          date: c.commit.author.date
        },
        message: c.commit.message
      },
      author: {
        login: c.author ? c.author.login : undefined
      }
    }))
  });
  const data = await api.fetch(url, limiter);

  if (data !== null) {
    if (fromOriginal) {
      fork.diff_from_original = printInfo('-', data, fork);
      fork.behind_by = data.behind_by;
    }
    else {
      fork.diff_to_original = printInfo('+', data, fork);
      fork.ahead_by = data.ahead_by;
    }
  }
}

function printInfo(sep, data, fork) {
  const length = data.commits.length;
  if (length === 0)
    return '0';

  const details = '<pre>' +
    data.commits
      .map(c => {
        c.author_date = c.commit.author.date.replace('Z', '').replace('T', ' ');
        c.author_login = c.author && c.author.login ? c.author.login : '-';
        const sha = c.sha.substr(0, 6);
        c.link = `<a href="https://github.com/${fork.owner.login}/${fork.name}/commit/${sha}">${sha}</a>`;
        return c;
      })
      .map(c => `${c.link} ${c.author_date.substr(0, 10)} ${c.author_login} - ${c.commit.message}`)
      .map(s => s.replace(/[\n\r]/g, ' ').substr(0, 150))
      .join('\n')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;') +
    '</pre>';

  const sort = `<!--${('000' + length).substr(-4)}-->`;
  return `${sort}<a tabindex="0" class="btn btn-sm btn-outline-secondary" data-toggle="popover" data-trigger="focus" data-html="true" data-placement="bottom" title="Commits" data-content="${details}">${sep}${length}</a>`;
}

function Progress(max) {
  const $progress = $('.progress');
  const $bar = $('.progress-bar');

  function show() { $progress.show(); }

  function hide() { $progress.hide(); }

  function update(count) {
    const val = Math.round((count / max) * 100) + '%';
    $bar.width(val);
    $bar.text(`${count} / ${max}`);
  }

  return { show, hide, update };
}

function Quota(api) {
  $('.quota').removeClass('d-none');
  const $quota = $('.quota #rate-limit');

  function update() {
    const rate = api.getLimits();
    const reset = moment(rate.reset).fromNow();
    $quota.html(`Quota: left ${rate.remaining} / ${rate.limit}<br/>Reset ${reset}`);
  }

  return { update };
}

function Api(token) {
  const config = token
    ? {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Token ' + token,
      }
    }
    // : undefined;
    // Work with no token provided. (Limits data availability.)
    : {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

  const rate = {
    remaining: '?',
    limit: '?',
    reset: new Date()
  };

  const cache = ApiCache();

  async function get(url, fnResponseLimiter) {
    try {
      const { cached, newConfig } = cache.get(url, config);
      const response = await fetch(url, newConfig);
      if (response.status === 304)
        return cached.data;
      if (response.status === 404)
        return null;
      if (!response.ok)
        throw Error(response.statusText);

      updateRate(response);

      const data = await response.json();
      const limitedData = fnResponseLimiter(data);

      cache.add(url, limitedData, response);

      return limitedData;

    } catch (error) {
      const msg =
        error.toString().indexOf('Forbidden') >= 0
          ? 'Error: API Rate Limit Exceeded'
          : error;
      showMsg(`${msg}. Additional info in console`, 'danger');

      throw error;
    }
  }

  function getLimits() { return rate; }

  async function refreshLimits() {
    const url = 'https://api.github.com/rate_limit';
    const response = await fetch(url, config);
    if (response.ok)
      updateRate(response);
  }

  function updateRate(response) {
    rate.limit = response.headers.get('x-ratelimit-limit');
    rate.remaining = response.headers.get('x-ratelimit-remaining');
    rate.reset = new Date(1000 * parseInt(response.headers.get('x-ratelimit-reset')));
  }

  return { fetch: get, getLimits, refreshLimits };
}

function ApiCache() {

  const map = new Map();
  const STORAGE = sessionStorage;

  function get(url, config) {
    const key = url.toLowerCase();
    const newConfig = JSON.parse(JSON.stringify(config));

    let cachedString = map.get(key);
    try {
      if (!cachedString) {
        cachedString = STORAGE.getItem(key);
        if (cachedString)
          map.set(key, cachedString);
      }
    } catch { }

    const cached = JSON.parse(cachedString);
    if (cached) {
      newConfig.headers['if-none-match'] = cached.etag;
      cached.date = new Date();
    }

    return { cached, newConfig };
  }

  function add(url, limitedData, response) {
    const key = url.toLowerCase();
    const val = JSON.stringify({
      etag: response.headers.get('etag'),
      date: new Date(),
      data: limitedData
    });

    map.set(key, val);
    try {
      STORAGE.setItem(key, val);
    } catch (err) {
    }
  }

  return { get, add };
}

const Runner = {
  start: function (diff) {
    running = true;
    if (diff) {
      $('#findDiff .find-label').text('Stop');
      $('#findDiff #spinner').addClass('d-inline-block');
    } else {
      $('#find .find-label').text('Stop');
      $('#find #spinner').addClass('d-inline-block');
    }
  },
  stop: function (diff) {
    running = false;
    if (diff) {
      $('#findDiff .find-label').text('Find with diff');
      $('#findDiff #spinner').removeClass('d-inline-block');
    } else {
      $('#find .find-label').text('Find');
      $('#find #spinner').removeClass('d-inline-block');
    }
  }
};

const Options = {

  loadAndShow: function () {
    $('#options')
      .on('show.bs.collapse', () => $('.options-button').addClass('options-button--expanded'))
      .on('hide.bs.collapse', () => $('.options-button').removeClass('options-button--expanded'));

    try {
      const savedString = localStorage.getItem('options');
      const saved = JSON.parse(savedString)
        || { sameSize: true, samePushDate: true, maxRecords: 100 };

      $('#sameSize').attr('checked', saved.sameSize);
      $('#samePushDate').attr('checked', saved.samePushDate);
      $('#maxRecords').val(saved.maxRecords);
    } catch { }
  },

  getAndSave: function () {
    const sameSize = $('#sameSize').is(':checked');
    const samePushDate = $('#samePushDate').is(':checked');
    const maxRecords = $('#maxRecords').val();

    const val = { sameSize, samePushDate, maxRecords };
    try {
      localStorage.setItem('options', JSON.stringify(val));
    } catch { }
    return val;
  }
};

function SimilarChecker(options) {
  const similarForks = new Map();

  function getKey(fork) {
    let key = '';
    if (options.sameSize) key += fork.size + '_';
    if (options.samePushDate) key += fork.pushed_at + '_';
    return key;
  }

  function apply(fork) {
    const key = getKey(fork);
    if (key.length > 0) {
      const similarFork = similarForks.get(key);
      if (similarFork) {
        fork.diff_from_original = similarFork.diff_from_original;
        fork.diff_to_original = similarFork.diff_to_original;
        return true;
      }
    }

    return false;
  }

  function cache(fork) {
    const key = getKey(fork);
    if (key.length > 0) {
      similarForks.set(key, {
        diff_from_original: fork.diff_from_original,
        diff_to_original: fork.diff_to_original
      });
    }
  }

  return { apply, cache };
}
