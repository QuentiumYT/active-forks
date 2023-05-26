# ![](https://github.githubassets.com/favicons/favicon.svg) GitHub active-forks

> Find the active github forks of a project

This project allows you to find the most active forks of a repository.

[丫 Find Active Fork](https://quentiumyt.github.io/active-forks/index.html)

## As Bookmarklet

If you would like to use this tool as a [_bookmarklet_](https://en.wikipedia.org/wiki/Bookmarklet),
you can do so by saving the following JavaScript code as the bookmarklet.
Since GitHub doesn't allow JavaScript in its Markdown, you can add it manually.
Hit `Ctrl+D` to create a **new bookmark** and paste the JavaScript below into the `URL`
or "Location" entry (you may have to click "More" to see the `URL` field).
Any time you're on a GitHub repo you can click the bookmarklet
and it'll bring up the Active Forks of that repo.

```javascript
javascript:!function(){if(title=document.title,title)if(thing=title.split(/(GitHub\s-\s)*([^:]*)/)[2],thing){var t="https://quentiumyt.github.io/active-forks/index.html#"+thing;window.open(t)}else window.alert("Not%20a%20valid%20GitHub%20page")}();
```

It's recommended to use just the `丫` [U+4E2B Character](https://unicode-table.com/en/4E2B/) as the name of the bookmarklet to keep it short and clear.

![Screenshot](screenshot.png "Active Forks in action")

## Features
- **List forks** of a GitHub repository
- **Advanced Filter** listings using _Custom Search Builder_
- **Simple Filter** listing using _Search_ term
- **List `10|25|50|100`** entrieswith _Previous_|_Next_|_&numero;_ pager
- **`ASC|DESC` Sort** listing by data type
- **`URL`** to _Repo_|_Owner_|_Forks_|_Open Issues_
