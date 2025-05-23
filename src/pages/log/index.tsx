import useFilterTreeData from '@/hooks/useFilterTreeData';
import { SharedContext } from '@/layouts';
import { depthFirstSearch } from '@/utils';
import config from '@/utils/config';
import { request } from '@/utils/http';
import { CloudDownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-layout';
import Editor from '@monaco-editor/react';
import CodeMirror from '@uiw/react-codemirror';
import { useOutletContext } from '@umijs/max';
import {
  Button,
  Empty,
  Input,
  message,
  Modal,
  Tooltip,
  Tree,
  TreeSelect,
  Typography,
} from 'antd';
import { saveAs } from 'file-saver';
import debounce from 'lodash/debounce';
import uniq from 'lodash/uniq';
import prettyBytes from 'pretty-bytes';
import { Key, useCallback, useEffect, useRef, useState } from 'react';
import intl from 'react-intl-universal';
import SplitPane from 'react-split-pane';
import styles from './index.module.less';

const { Text } = Typography;

const Log = () => {
  const { headerStyle, isPhone, theme } = useOutletContext<SharedContext>();
  const [value, setValue] = useState(intl.get('请选择日志文件'));
  const [select, setSelect] = useState<string>(intl.get('请选择日志文件'));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [height, setHeight] = useState<number>();
  const treeDom = useRef<any>();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [currentNode, setCurrentNode] = useState<any>();
  const [searchValue, setSearchValue] = useState('');

  const getLogs = () => {
    setLoading(true);
    request
      .get(`${config.apiPrefix}logs`)
      .then(({ code, data }) => {
        if (code === 200) {
          setData(data);
        }
      })
      .finally(() => setLoading(false));
  };

  const getLog = (node: any) => {
    request
      .get(
        `${config.apiPrefix}logs/detail?file=${node.title}&path=${
          node.parent || ''
        }`,
      )
      .then(({ code, data }) => {
        if (code === 200) {
          setValue(data);
        }
      });
  };

  const downloadLog = () => {
    request
      .post<Blob>(
        `${config.apiPrefix}logs/download`,
        {
          filename: currentNode.title,
          path: currentNode.parent || '',
        },
        { responseType: 'blob' },
      )
      .then((res) => {
        saveAs(res, currentNode.title);
      });
  };

  const onSelect = (value: any, node: any) => {
    if (node.key === select || !value) {
      return;
    }

    setCurrentNode(node);
    setSelect(value);

    if (node.type === 'directory') {
      setValue(intl.get('请选择日志文件'));
      return;
    }

    setValue(intl.get('加载中...'));
    getLog(node);
  };

  const onTreeSelect = useCallback((keys: Key[], e: any) => {
    onSelect(keys[0], e.node);
  }, []);

  const onSearch = useCallback(
    (e) => {
      const keyword = e.target.value;
      debounceSearch(keyword);
    },
    [data],
  );

  const debounceSearch = useCallback(
    debounce((keyword) => {
      setSearchValue(keyword);
    }, 300),
    [data],
  );

  const { treeData: filterData, keys: searchExpandedKeys } = useFilterTreeData(
    data,
    searchValue,
    { treeNodeFilterProp: 'title' },
  );

  useEffect(() => {
    setExpandedKeys(uniq([...expandedKeys, ...searchExpandedKeys]));
  }, [searchExpandedKeys]);

  const deleteFile = () => {
    Modal.confirm({
      title: `确认删除`,
      content: (
        <>
          {intl.get('确认删除')}
          <Text style={{ wordBreak: 'break-all' }} type="warning">
            {' '}
            {select}{' '}
          </Text>
          {intl.get('文件')}
          {currentNode.type === 'directory' ? intl.get('夹下所有日志') : ''}
          {intl.get('，删除后不可恢复')}
        </>
      ),
      onOk() {
        request
          .delete(`${config.apiPrefix}logs`, {
            data: {
              filename: currentNode.title,
              path: currentNode.parent || '',
              type: currentNode.type,
            },
          })
          .then(({ code }) => {
            if (code === 200) {
              message.success(`删除成功`);
              let newData = [...data];
              if (currentNode.parent) {
                newData = depthFirstSearch(
                  newData,
                  (c) => c.key === currentNode.key,
                );
              } else {
                const index = newData.findIndex(
                  (x) => x.key === currentNode.key,
                );
                if (index !== -1) {
                  newData.splice(index, 1);
                }
              }
              setData(newData);
              initState();
            }
          });
      },
    });
  };

  const initState = () => {
    setSelect('');
    setCurrentNode(null);
    setValue(intl.get('请选择脚本文件'));
  };

  const onExpand = (expKeys: any) => {
    setExpandedKeys(expKeys);
  };

  useEffect(() => {
    getLogs();
  }, []);

  useEffect(() => {
    if (treeDom.current) {
      setHeight(treeDom.current.clientHeight);
    }
  }, [treeDom.current, data]);

  return (
    <PageContainer
      className="ql-container-wrapper log-wrapper"
      title={
        <>
          {select}
          {currentNode?.type === 'file' && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 12,
                color: '#999',
                display: 'inline-block',
                height: 14,
              }}
            >
              {prettyBytes(currentNode.size)}
            </span>
          )}
        </>
      }
      loading={loading}
      extra={
        isPhone
          ? [
              <TreeSelect
                treeExpandAction="click"
                className="log-select"
                value={select}
                dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                treeData={data}
                placeholder={intl.get('请选择日志')}
                fieldNames={{ value: 'key' }}
                treeNodeFilterProp="title"
                showSearch
                allowClear
                onSelect={onSelect}
              />,
            ]
          : [
              <Tooltip title={intl.get('下载')}>
                <Button
                  disabled={!currentNode || currentNode.type === 'directory'}
                  type="primary"
                  onClick={downloadLog}
                  icon={<CloudDownloadOutlined />}
                />
              </Tooltip>,
              <Tooltip title={intl.get('删除')}>
                <Button
                  type="primary"
                  disabled={!currentNode}
                  onClick={deleteFile}
                  icon={<DeleteOutlined />}
                />
              </Tooltip>,
            ]
      }
      header={{
        style: headerStyle,
      }}
    >
      <div className={`${styles['log-container']} log-container`}>
        {!isPhone && (
          /*// @ts-ignore*/
          <SplitPane split="vertical" size={200} maxSize={-100}>
            <div className={styles['left-tree-container']}>
              {data.length > 0 ? (
                <>
                  <Input.Search
                    className={styles['left-tree-search']}
                    onChange={onSearch}
                    placeholder={intl.get('请输入日志名')}
                    allowClear
                  ></Input.Search>
                  <div className={styles['left-tree-scroller']} ref={treeDom}>
                    <Tree
                      expandAction="click"
                      className={styles['left-tree']}
                      treeData={filterData}
                      showIcon={true}
                      height={height}
                      selectedKeys={[select]}
                      showLine={{ showLeafIcon: true }}
                      onSelect={onTreeSelect}
                      expandedKeys={expandedKeys}
                      onExpand={onExpand}
                    ></Tree>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <Empty
                    description={intl.get('暂无日志')}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                </div>
              )}
            </div>
            <Editor
              language="shell"
              theme={theme}
              value={value}
              options={{
                readOnly: true,
                fontSize: 12,
                minimap: { enabled: false },
                lineNumbersMinChars: 3,
                folding: false,
                glyphMargin: false,
              }}
            />
          </SplitPane>
        )}
        {isPhone && (
          <CodeMirror
            value={value}
            readOnly={true}
            theme={theme.includes('dark') ? 'dark' : 'light'}
            onChange={(value, viewUpdate) => {
              setValue(value);
            }}
          />
        )}
      </div>
    </PageContainer>
  );
};

export default Log;
